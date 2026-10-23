package com.zettaremit.transaction.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.web.bind.annotation.*;

/** Stateless simulation only. FastAPI exclusively owns persistence and user authorization. */
@RestController
public class TransactionController {
    public record QuoteRequest(
        @NotBlank @Size(max=50) String ownerId,
        @Pattern(regexp="[A-Za-z0-9_-]{16,128}") @NotNull String requestId,
        @NotBlank @Size(max=255) String recipientName,
        @NotNull @DecimalMin(value="0", inclusive=false) @DecimalMax("1000000.00") @Digits(integer=10, fraction=2) BigDecimal grossAmount) {}
    public record QuoteResponse(String ownerId, String requestId, BigDecimal feeDeducted,
        BigDecimal netAmount, BigDecimal recipientAmount, BigDecimal exchangeRate, String status) {}

    @GetMapping("/health")
    public java.util.Map<String,String> health() { return java.util.Map.of("status","ok"); }

    @PostMapping("/internal/v1/quote")
    public QuoteResponse quote(@Valid @RequestBody QuoteRequest request) {
        BigDecimal rate = new BigDecimal("83.50000000");
        BigDecimal fee = request.grossAmount().multiply(new BigDecimal("0.03")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal net = request.grossAmount().subtract(fee).setScale(2, RoundingMode.HALF_UP);
        BigDecimal received = net.divide(rate, 2, RoundingMode.HALF_UP);
        return new QuoteResponse(request.ownerId(), request.requestId(), fee, net, received, rate, "SIMULATED");
    }
}
