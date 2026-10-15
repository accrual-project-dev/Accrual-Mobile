# Panduan Rilis iOS App Store & TestFlight dari Windows (Cloud CI/CD)

Panduan ini disusun khusus agar Anda dapat merilis dan mendistribusikan aplikasi **Accrual** ke **Apple TestFlight** dan **App Store** secara 100% mandiri dari komputer **Windows**, tanpa memerlukan perangkat Mac fisik.

---

## Ringkasan Alur Kerja

```
[Komputer Windows Anda]
       │
       ▼ (git push / trigger workflow)
[GitHub Repository]
       │
       ▼ (menjalankan runner Mac virtual macOS-14)
[GitHub Actions CI/CD]
   ├─ npm run build
   ├─ npx cap sync ios
   ├─ xcodebuild archive & codesign
   └─ xcrun altool upload
       │
       ▼
[Apple App Store Connect / TestFlight]
       │
       ▼ (notifikasi otomatis)
[iPhone Fisik Anda (via Aplikasi TestFlight)]
```

---

## Bagian 1: Persiapan Akun Apple Developer (Cukup dari Browser Windows)

1. Buka [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll) melalui browser Anda di Windows.
2. Masuk menggunakan Apple ID Anda (atau buat Apple ID khusus perusahaan/studio Anda).
3. Pilih pendaftaran sebagai **Individual** (atau **Organization** jika Anda memiliki entitas PT/CV dengan nomor D-U-N-S).
4. Lakukan pembayaran pendaftaran **Apple Developer Program** (\$99/tahun).
   > *Catatan: Akun ini dapat digunakan untuk menerbitkan semua aplikasi iOS Anda (Accrual dan 2 aplikasi lainnya) tanpa biaya tambahan.*

---

## Bagian 2: Daftarkan Identitas Aplikasi (App ID & Bundle ID)

1. Masuk ke [developer.apple.com/account](https://developer.apple.com/account).
2. Masuk ke menu **Certificates, Identifiers & Profiles** -> **Identifiers**.
3. Klik tombol **+** (tambah identitas baru) -> Pilih **App IDs** -> Klik **Continue**.
4. Pilih tipe **App** -> Klik **Continue**.
5. Isi formulir:
   - **Description**: `Accrual`
   - **Bundle ID**: Pilih `Explicit` dan masukkan:  
     `com.syntheticae.accrual`
6. Pada daftar **Capabilities**, centang kemampuan yang digunakan aplikasi:
   - **In-App Purchase** (untuk langganan Accrual Pro)
7. Klik **Continue** -> **Register**.

---

## Bagian 3: Buat App Store Connect API Key (Untuk Akses Unggah Otomatis)

1. Masuk ke [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Di pojok atas, buka menu **Users and Access** -> Pilih tab **Integrations** (atau **Keys**).
3. Klik tombol **+** untuk membuat kunci baru:
   - **Name**: `GitHub Actions Deploy`
   - **Access**: Pilih peran `App Manager` atau `Admin`.
4. Setelah terbuat, Anda akan mendapatkan:
   - **Issuer ID** (contoh: `69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx` di bagian atas tabel).
   - **Key ID** (contoh: `2X9R427HK2`).
5. Klik **Download API Key** untuk mengunduh berkas private key (`AuthKey_XXXXXX.p8`).
   > *PENTING: Berkas `.p8` ini hanya bisa diunduh satu kali oleh Apple. Simpan berkas ini dengan aman.*

---

## Bagian 4: Sertifikat Distribusi & Provisioning Profile

### Opsi A (Paling Mudah dari Windows via OpenSSL):

1. **Buat CSR (Certificate Signing Request) di Windows**  
   Buka terminal PowerShell di Windows dan jalankan:
   ```powershell
   # Buat kunci privat dan CSR
   openssl genrsa -out distribution.key 2048
   openssl req -new -key distribution.key -out distribution.csr -subj "/CN=Accrual Distribution/emailAddress=support@syntheticae.com"
   ```
2. **Kirim CSR ke Apple Developer Portal**  
   - Buka **Certificates** -> Klik **+** -> Pilih **Apple Distribution**.
   - Unggah berkas `distribution.csr` yang baru Anda buat.
   - Unduh sertifikat yang dihasilkan Apple (`distribution.cer`).
3. **Ekspor Sertifikat ke format `.p12` di Windows**  
   Jalankan di PowerShell:
   ```powershell
   openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
   openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12 -passout pass:PasswordRahasiaAnda123
   ```
4. **Unduh Provisioning Profile**  
   - Buka menu **Profiles** di Apple Developer Portal -> Klik **+**.
   - Pilih **App Store** (di bawah Distribution) -> Klik **Continue**.
   - Pilih App ID: `com.syntheticae.accrual`.
   - Pilih sertifikat **Apple Distribution** yang baru Anda buat.
   - Beri nama profil: `Accrual AppStore Distribution`.
   - Klik **Generate** dan unduh berkas (`Accrual_AppStore_Distribution.mobileprovision`).

---

## Bagian 5: Konfigurasi GitHub Secrets

Buka repositori **Accrual-Mobile** di browser:  
`https://github.com/accrual-project-dev/Accrual-Mobile` -> Buka tab **Settings** -> **Secrets and variables** -> **Actions** -> Klik **New repository secret**.

Tambahkan 6 rahasia berikut:

| Nama Secret | Deskripsi / Cara Mengisi |
| :--- | :--- |
| `APPLE_TEAM_ID` | 10 karakter Team ID Anda (terlihat di pojok kanan atas Apple Developer Portal, contoh: `A1B2C3D4E5`). |
| `APPLE_CERTIFICATE_BASE64` | Isi teks Base64 dari berkas `distribution.p12`. *(Cara ambil di PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("distribution.p12")) \| Set-Clipboard`)* |
| `APPLE_CERTIFICATE_PASSWORD` | Password yang Anda tentukan saat mengekspor `.p12` (misal: `PasswordRahasiaAnda123`). |
| `APPLE_PROVISION_PROFILE_BASE64` | Isi teks Base64 dari berkas `.mobileprovision`. *(Cara ambil di PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("Accrual_AppStore_Distribution.mobileprovision")) \| Set-Clipboard`)* |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID dari App Store Connect (misal: `2X9R427HK2`). |
| `APP_STORE_CONNECT_API_ISSUER_ID` | Issuer ID dari App Store Connect (misal: `69a6de70-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Isi teks Base64 dari berkas `AuthKey_XXXXXX.p8`. *(Cara ambil di PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXX.p8")) \| Set-Clipboard`)* |

---

## Bagian 6: Menjalankan Build & Rilis ke TestFlight

Setelah rahasia di atas tersimpan, Anda tidak perlu Mac sama sekali untuk merilis pembaruan:

1. Buka tab **Actions** di GitHub repository `Accrual-Mobile`.
2. Di sebelah kiri, pilih alur kerja **Deploy iOS to App Store (TestFlight)**.
3. Klik tombol **Run workflow** -> Pilih branch `main` -> Tekan tombol hijau **Run workflow**.
4. GitHub Actions akan otomatis:
   - Menyiapkan macOS virtual terbaru.
   - Mengompilasi aplikasi web dan sinkronisasi Capacitor iOS.
   - Menandatangani berkas dengan sertifikat resmi Anda.
   - Mengunggah paket aplikasi langsung ke **TestFlight**.
5. Sekitar 10–15 menit kemudian, Anda akan menerima email dari Apple bahwa versi baru sudah siap diuji di iPhone Anda melalui aplikasi **TestFlight**!
