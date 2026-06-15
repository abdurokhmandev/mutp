# Walkthrough - Telegram OTP Verification and Link Fixes

We have analyzed and fixed the issue where the Telegram bot was not providing the verification code during the registration or login process.

## Changes Made

### 1. Telegram User Bot Registration Flow
* Modified [bot.py](file:///c:/Users/abdur/OneDrive/Desktop/mutp/darslik_backend/apps/bot/bot.py) so that when a user executes the `/start <phone>` command, a `TelegramUser` record is created or updated in the database.
* Previously, it was only updating the `User` model, which does not exist for new users registering, causing the backend to think they hadn't started the bot.

### 2. View OTP Integration
* Updated `SendOTPView` and `VerifyOTPView` in [views.py](file:///c:/Users/abdur/OneDrive/Desktop/mutp/darslik_backend/apps/users/views.py):
  * Allowed the views to import and use the correct `send_otp` helper at the module level.
  * Ensured `SendOTPView` checks if `TelegramUser` exists using either normalized (`998...`) or formatted (`+998...`) phone numbers.
  * Fixed `VerifyOTPView` to handle OTP verification via both the Django cache (which was used by tests and some authentication flows) and the database `PhoneOTP` model.
  * Imported the missing `format_phone` function in `SaveTelegramUserView`.

### 3. Async Database Query Fix
* Fixed a synchronous database query exception in `send_otp_telegram_async` inside [otp.py](file:///c:/Users/abdur/OneDrive/Desktop/mutp/darslik_backend/apps/users/otp.py) by moving the database query to the synchronous `send_otp` wrapper.

## Verification
* Ran automated unit tests:
  ```powershell
  .\venv\Scripts\python.exe manage.py test apps.users
  ```
  Result: **6 tests passed successfully (OK)**.
