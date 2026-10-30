const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const config=require('../preview/metro.config');
const parent=path.resolve(__dirname,'..');
test('preview Metro redirects the Dashboard API import to fictional mocks',()=>{
  const result=config.resolver.resolveRequest({originModulePath:path.join(parent,'screens/DashboardScreen.js')},'../lib/api','web');
  assert.equal(result.filePath,path.join(parent,'preview/mockApi.js'));
});
test('preview Metro rejects accidental production API/client imports',()=>{
  for(const file of ['api.js','client.js']){
    const context={originModulePath:path.join(parent,'preview/index.js'),
      resolveRequest:()=>({type:'sourceFile',filePath:path.join(parent,'lib',file)})};
    assert.throws(()=>config.resolver.resolveRequest(context,'unexpected','web'),/forbidden/);
  }
});
