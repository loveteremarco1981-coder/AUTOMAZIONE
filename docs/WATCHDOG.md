name: Deploy to Apps Script

on:
  push:
    branches:
      - main
    paths:
      - "**.gs"
      - "appsscript.json"

jobs:

  deploy:

    runs-on: ubuntu-latest

    steps:

      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install clasp
        run: npm install -g @google/clasp

      - name: Authentication
        run: echo '${{ secrets.CLASP_TOKEN }}' > ~/.clasprc.json

      - name: Clasp Status
        run: clasp status

      - name: Push to Apps Script
        run: clasp push --force
