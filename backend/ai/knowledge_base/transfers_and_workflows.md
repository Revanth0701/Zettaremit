# Transfer Workflows and Recipient Details

## Step-by-Step Send Money Flow
The Send Money process is organized into a clean, sequential wizard on the user dashboard:

### Step 1: Recipient Information
- **Recipient Full Name**: Required field between 1 and 255 characters. Must contain printable characters.
- **US Bank Account Number**: The destination bank account number in the United States.
- **Routing Number / SWIFT Code**: US 9-digit ABA routing number or SWIFT/BIC code for the receiving bank.

### Step 2: Account & Delivery Review
- The user reviews the entered recipient banking information before specifying amounts.

### Step 3: Transfer Amount & Live Quote
- **Enter Amount**: The user enters an INR gross transfer amount (between greater than 0 and ₹1,000,000.00 INR).
- **Automatic Exchange Quote**: The system debounces input changes by 400ms and automatically requests a signed exchange quote from the backend.
- **Exchange Rate Box**: Displays the current market reference rate (`1 USD = ₹[rate]`) directly above the input.
- **Summary Breakdown**: Displays the 3% platform fee, net INR amount, and guaranteed USD payout.
- **Single Proceed Action**: The user clicks the blue "Proceed" button, which automatically accepts the active signed quote and advances to payment. If the quote expired, a fresh quote is calculated.

### Step 4: Simulated Payment Method Selection
The user chooses how the simulated transfer is funded:
- **Option A - Simulated UPI**: Enter a simulated UPI ID (e.g., `user@upi`) and verify.
- **Option B - Simulated NetBanking**: Enter Indian bank details including Account Holder Name, Bank Name, Indian Account Number, and IFSC Code.
*(Note: As a simulation platform, no actual bank accounts or UPI handles are debited; no real money or actual cash leaves your Indian bank account).*

### Step 5: Final Review & Submission
- The client generates a unique 16–128 character `Idempotency-Key` header.
- The client submits the transfer request along with the cryptographically signed `quote_token`.
- Both Python and Java calculation engines redundantly verify the arithmetic.
- The transaction record is committed to the database with status `SIMULATED`.

### Step 6: Transaction Confirmation & Receipt
- Displays the transaction receipt with the unique identifier `TXN-[UUID]`.
- Displays the explicit confirmation message: *"Simulated transfer recorded; no funds moved"*.

## Viewing Transaction History
- Users can review their simulated transfers on the dashboard at any time.
- Fetched via `GET /transactions/` (paginated up to 100 transactions, default 50).
- Displays chronological transaction records showing recipient name, gross amount, fee deducted, exchange rate, net amount, recipient amount, date/time, and `SIMULATED` status.
