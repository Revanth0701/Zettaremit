package com.zettaremit.transaction

import com.zettaremit.transaction.controller.TransactionController
import com.zettaremit.transaction.security.InternalAuthenticationFilter
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.http.MediaType
import spock.lang.Specification
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

class TransactionServiceSpec extends Specification {
    def secret = "synthetic-test-service-token-32-characters"
    def mvc = MockMvcBuilders.standaloneSetup(new TransactionController())
        .addFilters(new InternalAuthenticationFilter(secret)).build()
    def payload = '{"ownerId":"synthetic","requestId":"test-request-0001","recipientName":"Synthetic","grossAmount":"1000.00","exchangeRate":"83.50000000"}'

    def "reject missing or incorrect service credentials"() {
        expect:
        mvc.perform(post('/internal/v2/quote').contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isUnauthorized())
        mvc.perform(post('/internal/v2/quote').header('Authorization','Bearer wrong').contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isUnauthorized())
    }
    def "authenticated quote is decimal safe and never claims settlement"() {
        expect:
        mvc.perform(post('/internal/v2/quote').header('Authorization','Bearer '+secret).contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isOk()).andExpect(jsonPath('$.feeDeducted').value(30.0d))
            .andExpect(jsonPath('$.netAmount').value(970.0d))
            .andExpect(jsonPath('$.recipientAmount').value(11.62d))
            .andExpect(jsonPath('$.status').value('SIMULATED'))
    }
    def "reject invalid amount and unknown fields"() {
        expect:
        mvc.perform(post('/internal/v2/quote').header('Authorization','Bearer '+secret).contentType(MediaType.APPLICATION_JSON).content(payload.replace('1000.00','-1')))
            .andExpect(status().isBadRequest())
        mvc.perform(post('/internal/v2/quote').header('Authorization','Bearer '+secret).contentType(MediaType.APPLICATION_JSON).content(payload.replace('"ownerId"','"unexpected"')))
            .andExpect(status().isBadRequest())
    }
    def "legacy public transaction endpoints are removed"() {
        expect:
        mvc.perform(get('/api/v1/transactions')).andExpect(status().isUnauthorized())
        mvc.perform(get('/api/v1/transactions').header('Authorization','Bearer '+secret)).andExpect(status().isNotFound())
        mvc.perform(get('/health')).andExpect(status().isOk())
    }
    def "missing internal secret prevents startup"() {
        when: new InternalAuthenticationFilter('')
        then: thrown(IllegalStateException)
    }
    def "application context has no datasource or persistence engine"() {
        expect:
        new org.springframework.boot.test.context.runner.WebApplicationContextRunner()
            .withUserConfiguration(com.zettaremit.transaction.TransactionServiceApplication)
            .withPropertyValues('internal.service.token='+secret)
            .run { context ->
                assert context.startupFailure == null
                assert !context.containsBean('dataSource')
                assert !context.containsBean('entityManagerFactory')
                assert context.getBean(TransactionController) != null
            }
    }
}
