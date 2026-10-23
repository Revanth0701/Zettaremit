"""Pure mocked supervisor lifecycle checks; never starts a process/server."""
import importlib.util
from pathlib import Path
import signal
import unittest
from unittest.mock import Mock, patch

spec=importlib.util.spec_from_file_location('runtime_supervisor',Path(__file__).resolve().parent.parent/'deployment/run_services.py')
supervisor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(supervisor)

class SupervisorTests(unittest.TestCase):
    def exercise(self,graceful):
        handlers={}
        java=Mock();api=Mock()
        state={'java':None,'api':None,'notified':False}
        java.poll.side_effect=lambda:state['java']
        java.terminate.side_effect=lambda:state.update(java=0)
        api.terminate.side_effect=lambda:state.update(api=0)
        def poll_api():
            if graceful and not state['notified']:
                state['notified']=True
                handlers[signal.SIGTERM](signal.SIGTERM,None)
            else:state['api']=1
            return state['api']
        api.poll.side_effect=poll_api
        with patch.object(supervisor.signal,'signal',side_effect=lambda sig,fn:handlers.update({sig:fn})),patch.object(supervisor.subprocess,'Popen',side_effect=[java,api]),patch.object(supervisor.socket,'create_connection'),patch.object(supervisor.time,'sleep'):
            result=supervisor.main()
        java.terminate.assert_called();java.wait.assert_called();api.wait.assert_called()
        return result
    def test_requested_shutdown_is_clean(self):self.assertEqual(self.exercise(True),0)
    def test_unexpected_api_exit_fails_closed(self):self.assertEqual(self.exercise(False),1)

if __name__=='__main__':unittest.main()
