package com.zettaremit.transaction.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "service_transactions")
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", unique = true, nullable = false)
    private String transactionId;

    @Column(name = "recipient_name", nullable = false)
    private String recipientName;

    @Column(name = "gross_amount", nullable = false)
    private Double grossAmount;

    @Column(name = "fee_deducted")
    private Double feeDeducted;

    @Column(name = "net_amount")
    private Double netAmount;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Transaction() {}

    public Transaction(String transactionId, String recipientName, Double grossAmount, Double feeDeducted, Double netAmount, String status) {
        this.transactionId = transactionId;
        this.recipientName = recipientName;
        this.grossAmount = grossAmount;
        this.feeDeducted = feeDeducted;
        this.netAmount = netAmount;
        this.status = status;
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public Double getGrossAmount() { return grossAmount; }
    public void setGrossAmount(Double grossAmount) { this.grossAmount = grossAmount; }
    public Double getFeeDeducted() { return feeDeducted; }
    public void setFeeDeducted(Double feeDeducted) { this.feeDeducted = feeDeducted; }
    public Double getNetAmount() { return netAmount; }
    public void setNetAmount(Double netAmount) { this.netAmount = netAmount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}