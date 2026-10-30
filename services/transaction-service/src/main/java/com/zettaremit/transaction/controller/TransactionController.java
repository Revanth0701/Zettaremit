package com.zettaremit.transaction.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.io.IOException;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import org.springframework.web.bind.annotation.*;

/** Stateless simulation only. FastAPI exclusively owns persistence and user authorization. */
@RestController
public class TransactionController {
    public record SnapshotQuoteRequest(
        @NotBlank @Size(max=50) String ownerId,
        @Pattern(regexp="[A-Za-z0-9_-]{16,128}") @NotNull String requestId,
        @NotBlank @Size(max=255) String recipientName,
        @NotNull @DecimalMin(value="0", inclusive=false) @DecimalMax("1000000.00") @Digits(integer=10, fraction=2) BigDecimal grossAmount,
        @NotNull @Pattern(regexp="[0-9]{1,10}\\.[0-9]{8}")
        @DecimalMin(value="0", inclusive=false) @DecimalMax("9999999999.99999999")
        @JsonDeserialize(using=RateStringDeserializer.class) String exchangeRate) {}

    /** Reject JSON numbers rather than coercing binary-decimal representations. */
    public static class RateStringDeserializer extends JsonDeserializer<String> {
        @Override
        public String deserialize(JsonParser parser, DeserializationContext context) throws IOException {
            if (!parser.hasToken(JsonToken.VALUE_STRING)) {
                return context.reportInputMismatch(String.class, "Exchange rate must be a decimal string");
            }
            return parser.getText();
        }
    }
    public record QuoteResponse(String ownerId, String requestId, BigDecimal feeDeducted,
        BigDecimal netAmount, BigDecimal recipientAmount, BigDecimal exchangeRate, String status) {}

    @GetMapping("/health")
    public java.util.Map<String,String> health() { return java.util.Map.of("status","ok"); }

    @PostMapping("/internal/v2/quote")
    public QuoteResponse snapshotQuote(@Valid @RequestBody SnapshotQuoteRequest request) {
        return calculate(request.ownerId(), request.requestId(), request.grossAmount(), new BigDecimal(request.exchangeRate()));
    }

    private QuoteResponse calculate(String ownerId, String requestId, BigDecimal gross, BigDecimal rate) {
        BigDecimal fee = gross.multiply(new BigDecimal("0.03")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = gross.subtract(fee).setScale(2, RoundingMode.HALF_UP);
        BigDecimal received = net.divide(rate, 2, RoundingMode.HALF_UP);
        return new QuoteResponse(ownerId, requestId, fee, net, received, rate, "SIMULATED");
    }
}
