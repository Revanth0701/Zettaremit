package com.zettaremit.transaction;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zettaremit.transaction.controller.TransactionController;
import com.zettaremit.transaction.security.InternalAuthenticationFilter;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Standalone servlet mocks only: no application server, datasource or network. */
class SnapshotQuoteTest {
    private final String secret = "synthetic-test-service-token-at-least-32-characters";
    private final ObjectMapper mapper = new ObjectMapper();
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new TransactionController())
        .addFilters(new InternalAuthenticationFilter(secret)).build();

    private ObjectNode payload(String gross) {
        return mapper.createObjectNode().put("ownerId", "synthetic").put("requestId", "synthetic-request-0001")
            .put("recipientName", "Synthetic").put("grossAmount", gross);
    }

    private org.springframework.test.web.servlet.MvcResult send(String path, ObjectNode body, boolean authenticated) throws Exception {
        var request = post(path).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsBytes(body));
        if (authenticated) request.header("Authorization", "Bearer " + secret);
        return mvc.perform(request).andReturn();
    }

    @Test void sharedPythonVectorsMatchExactBigDecimalCalculations() throws Exception {
        try (var stream = getClass().getResourceAsStream("/exchange_rate_vectors.json")) {
            assertNotNull(stream);
            for (JsonNode vector : mapper.readTree(stream)) {
                var body = payload(vector.get("gross").asText()).put("exchangeRate", vector.get("rate").asText());
                var response = send("/internal/v2/quote", body, true).getResponse();
                assertEquals(200, response.getStatus());
                // Parse decimals from JSON text, avoiding double precision in assertions.
                var decimalMapper = new ObjectMapper().enable(com.fasterxml.jackson.databind.DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
                var result = decimalMapper.readTree(response.getContentAsString());
                String[][] fields = {{"feeDeducted", "fee"}, {"netAmount", "net"}, {"recipientAmount", "payout"}, {"exchangeRate", "rate"}};
                for (String[] field : fields) {
                    assertEquals(0, new BigDecimal(vector.get(field[1]).asText()).compareTo(result.get(field[0]).decimalValue()), field[0]);
                }
                assertEquals("SIMULATED", result.get("status").asText());
                assertEquals("synthetic", result.get("ownerId").asText());
                assertEquals("synthetic-request-0001", result.get("requestId").asText());
            }
        }
    }

    @Test void missingAndInvalidRatesAreRejectedWithoutFallback() throws Exception {
        assertEquals(400, send("/internal/v2/quote", payload("1000"), true).getResponse().getStatus());
        assertEquals(400, send("/internal/v2/quote", payload("1000").putNull("exchangeRate"), true).getResponse().getStatus());
        for (String rate : new String[]{"", "0.00000000", "-1.00000000", "NaN", "Infinity", "1e2", "80", "80.123456789", "10000000000.00000000", " 80.00000000"}) {
            assertEquals(400, send("/internal/v2/quote", payload("1000").put("exchangeRate", rate), true).getResponse().getStatus(), rate);
        }
        assertEquals(400, send("/internal/v2/quote", payload("1000").put("exchangeRate", 80.12345678), true).getResponse().getStatus());
        assertEquals(400, send("/internal/v2/quote", payload("1000").put("exchangeRate", true), true).getResponse().getStatus());
    }

    @Test void v2RetainsAuthenticationAndGrossAmountValidation() throws Exception {
        var body = payload("1000").put("exchangeRate", "80.00000000");
        assertEquals(401, send("/internal/v2/quote", body, false).getResponse().getStatus());
        for (String gross : new String[]{"0", "-1", "1000000.01", "1.001"}) {
            assertEquals(400, send("/internal/v2/quote", payload(gross).put("exchangeRate", "80.00000000"), true).getResponse().getStatus());
        }
    }

    @Test void legacyFixedRateEndpointIsRemoved() throws Exception {
        var response = send("/internal/v1/quote", payload("1000"), true).getResponse();
        assertEquals(404, response.getStatus());
    }
}
