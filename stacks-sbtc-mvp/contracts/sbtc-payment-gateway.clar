;; title: sbtc-payment-gateway
;; version: 1.0.0
;; summary: A simple sBTC payment gateway contract
;; description: Allows users to pay in sBTC and records payments

;; traits
;;

;; token definitions
;;

;; constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant SBTC-CONTRACT 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token)

;; data vars
;; Default merchant (legacy). For multi-merchant, use the `pay-to` function which accepts a merchant principal.
(define-data-var merchant-principal principal CONTRACT-OWNER)

;; data maps
;; Map to store payment details: payment-id -> {amount, payer, merchant, timestamp}
(define-map payments uint {amount: uint, payer: principal, merchant: principal, timestamp: uint})

;; public functions
;; Public function for users to make a payment to the legacy default merchant (kept for backward compatibility)
(define-public (pay (payment-id uint) (amount uint))
  (let ((res (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (var-get merchant-principal) none)))
    (match res ok-val
      (begin
        ;; Record the payment
        (map-set payments payment-id {amount: amount, payer: tx-sender, merchant: (var-get merchant-principal), timestamp: stacks-block-height})
        (ok payment-id)
      )
      err-code (err err-code)
    )
  )
)

;; Public function: multi-merchant payment. Payer chooses merchant principal.
(define-public (pay-to (payment-id uint) (amount uint) (merchant principal))
  (let ((res (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender merchant none)))
    (match res ok-val
      (begin
        (map-set payments payment-id {amount: amount, payer: tx-sender, merchant: merchant, timestamp: stacks-block-height})
        (ok payment-id)
      )
      err-code (err err-code)
    )
  )
)

;; Admin function to withdraw funds (legacy; only applies if funds were sent to the contract)
(define-public (withdraw (amount uint) (to principal))
  (if (is-eq tx-sender (var-get merchant-principal))
    (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount (as-contract tx-sender) to none))
    (err u1)
  )
)

;; Function to set merchant (only by owner)
(define-public (set-merchant (new-merchant principal))
  (if (is-eq tx-sender CONTRACT-OWNER)
    (ok (var-set merchant-principal new-merchant))
    (err u2)
  )
)

;; read only functions
;; Read-only function to check payment status
(define-read-only (get-payment (id uint))
  (map-get? payments id)
)

;; Read-only function to expose the configured sBTC token contract
(define-read-only (get-sbtc-contract)
  SBTC-CONTRACT
)

;; Read-only function to get merchant principal
(define-read-only (get-merchant)
  (var-get merchant-principal)
)

;; Read-only: get sBTC balance for an owner
(define-read-only (get-sbtc-balance (owner principal))
  (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance owner)
)

;; Read-only: get sBTC balance of this contract principal
(define-read-only (get-contract-sbtc-balance)
  (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance (as-contract tx-sender))
)

;; Public: attempt an sBTC transfer and return raw response (for diagnostics)
(define-public (debug-transfer (amount uint))
  (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none)
)

;; private functions
;;

