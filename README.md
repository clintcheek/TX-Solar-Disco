# Texas Solar Borrower Discovery

A Windows desktop application that helps collect permitted county public-record downloads and produces a borrower-focused Excel workbook.

## What it does now

- Opens the selected county clerk/public-record website in your normal browser.
- Lets you complete any CAPTCHA or acknowledgement yourself.
- Processes downloaded text-based PDF, TXT, CSV, JSON, and HTML files.
- Keeps records only when both a target lender and UCC/PACE language are found.
- Extracts borrower name, address, phone, email, lender, loan type, loan amount, and loan date.
- Deduplicates exact borrower/address/lender/date combinations.
- Creates `Texas_Solar_Borrowers_YYYY-MM-DD.xlsx`.

## Important limitation in build 0.1

Image-only scanned PDFs are not OCR'd yet. The program will process PDFs that contain selectable text. County-specific automatic search navigation is also not enabled yet; this first build is deliberately human-assisted so it does not attempt to bypass CAPTCHAs or access controls.

## Build the Windows application with GitHub — no Python required

1. Create a free GitHub account if needed.
2. Create a new private repository.
3. Upload every file and folder from this project, preserving `.github/workflows/build-windows.yml`.
4. Open the repository's **Actions** tab.
5. Select **Build Windows App** and click **Run workflow**.
6. When it finishes, open the completed run and download the artifact named **Texas-Solar-Borrower-Windows**.
7. Unzip it and run the portable `.exe`, or use the installer `.exe`.

## Basic workflow

1. Open a county portal from the app.
2. Search a target lender using full-text OCR when the portal supports it.
3. Restrict the search to UCC, fixture filing, or PACE records where possible.
4. Download permitted documents/results into one folder.
5. Choose that folder in the app.
6. Click **Extract and Build Excel**.

## Pilot counties

Dallas, Tarrant, Collin, Rockwall, Kaufman, Van Zandt, Rains, Hunt, Wood, Smith, Ellis, Hopkins, Fannin, Lamar, Taylor, Grayson, and Jones.

## Editing the lender list

Edit `config/lenders.json`. Each lender has a standardized output name and one or more aliases.
