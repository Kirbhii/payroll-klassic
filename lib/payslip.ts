/**
 * Payslip file export.
 *
 * The screen version prints fine, but printing only opens the browser dialog —
 * there is no file to keep or email. These helpers produce real files:
 *
 *   - Word  : a standalone HTML document Word opens natively (.doc).
 *   - PDF   : the rendered card rasterised onto A4 pages.
 *
 * Both keep the peso sign, which is why the PDF is drawn from the DOM rather
 * than rebuilt with a PDF font that has no U+20B1 glyph.
 */

import type { PayslipDoc } from "./types";
import type { PayrollResult } from "./ph";
import { peso, displayName, longDate } from "./format";

/** Signatory printed on every payslip. */
export const AUTHORISED_BY = "Jian Mae Librero";

/* --------------------------------- helpers -------------------------------- */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** `Juan_Dela_Cruz_2026-10-01.pdf` — safe on every filesystem. */
export function payslipFilename(doc: PayslipDoc, extension: string): string {
  const who = displayName(doc.employeeName).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `Payslip_${who || "Employee"}_${doc.input.periodEnd}.${extension}`;
}

/* ---------------------------------- word ---------------------------------- */

export function payslipHtml(doc: PayslipDoc, result: PayrollResult): string {
  const earnings = [
    { label: "Basic pay (semi-monthly)", amount: result.cutoffBasic },
    { label: "Taxable allowances (semi-monthly)", amount: result.cutoffAllowances },
  ].filter((e) => e.amount > 0);

  const moneyRow = (label: string, amount: string, bold = false) => `
        <tr>
          <td style="padding:3px 0;${bold ? "font-weight:bold;border-top:1px solid #cbd5e1;" : ""}">${esc(label)}</td>
          <td style="padding:3px 0;text-align:right;${bold ? "font-weight:bold;border-top:1px solid #cbd5e1;" : ""}">${esc(amount)}</td>
        </tr>`;

  const table = (heading: string, rows: string) => `
      <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:9.5pt;">
        <tr>
          <td colspan="2" style="padding-bottom:3px;border-bottom:1px solid #e2e8f0;font-size:8pt;font-weight:bold;letter-spacing:1px;color:#64748b;">${heading}</td>
        </tr>${rows}
      </table>`;

  const info = (label: string, value: string) => `
        <td style="padding:2px 0;">
          <div style="font-size:7.5pt;letter-spacing:0.5px;color:#94a3b8;">${esc(label)}</div>
          <div style="font-size:9.5pt;font-weight:bold;">${esc(value || "—")}</div>
        </td>`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(`Payslip — ${displayName(doc.employeeName)}`)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 portrait; margin: 1.8cm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #0f172a; }
  table { border-collapse: collapse; }
</style>
</head>
<body>

<table cellspacing="0" cellpadding="0" style="width:100%;border-bottom:2px solid #0f172a;padding-bottom:8px;">
  <tr>
    <td style="vertical-align:top;">
      <div style="font-size:12pt;font-weight:bold;letter-spacing:0.5px;">${esc(doc.companyName)}</div>
      <div style="font-size:8.5pt;color:#64748b;">${esc(doc.companyLocation)}</div>
    </td>
    <td style="vertical-align:top;text-align:right;">
      <div style="font-size:10pt;font-weight:bold;letter-spacing:2px;">PAYSLIP</div>
      <div style="font-size:8pt;color:#64748b;">Semi-monthly cut-off</div>
    </td>
  </tr>
</table>

<table cellspacing="0" cellpadding="0" style="width:100%;margin-top:12px;">
  <tr>
    ${info("Employee name", displayName(doc.employeeName))}
    ${info("Position", doc.position)}
    ${info("Company", doc.companyName)}
    ${info("Monthly basic", peso(result.monthlyBasic))}
  </tr>
  <tr>
    ${info("Pay period", `${longDate(doc.input.periodStart)} – ${longDate(doc.input.periodEnd)}`)}
    ${info("Pay date", longDate(doc.input.periodEnd))}
    <td></td>
    <td></td>
  </tr>
</table>

<table cellspacing="0" cellpadding="0" style="width:100%;margin-top:16px;">
  <tr>
    <td style="width:48%;vertical-align:top;">
      ${table("EARNINGS", earnings.map((e) => moneyRow(e.label, peso(e.amount))).join("") + moneyRow("Gross pay", peso(result.gross), true))}
    </td>
    <td style="width:4%;"></td>
    <td style="width:48%;vertical-align:top;">
      ${table(
        "DEDUCTIONS",
        result.lines.map((line) => moneyRow(line.label, peso(line.amount))).join("") +
          moneyRow("Total deductions", peso(result.totalDeductions), true)
      )}
    </td>
  </tr>
</table>

<table cellspacing="0" cellpadding="0" style="width:100%;margin-top:14px;background:#0f5132;color:#ffffff;">
  <tr>
    <td style="padding:10px 14px;">
      <div style="font-size:7.5pt;letter-spacing:1.5px;color:#cbd5e1;">NET PAY</div>
      <div style="font-size:8pt;color:#cbd5e1;">Gross ${esc(peso(result.gross))} &minus; deductions ${esc(peso(result.totalDeductions))}</div>
    </td>
    <td style="padding:10px 14px;text-align:right;font-size:16pt;font-weight:bold;">${esc(peso(result.netPay))}</td>
  </tr>
</table>

<table cellspacing="0" cellpadding="0" style="width:100%;margin-top:44px;">
  <tr>
    <td style="width:45%;vertical-align:bottom;">
      <div style="border-bottom:1px solid #94a3b8;height:26px;"></div>
      <div style="font-size:9.5pt;font-weight:bold;text-transform:uppercase;padding-top:4px;">${esc(displayName(doc.employeeName))}</div>
      <div style="font-size:8pt;color:#64748b;">Employee signature</div>
    </td>
    <td style="width:10%;"></td>
    <td style="width:45%;vertical-align:bottom;">
      <div style="border-bottom:1px solid #94a3b8;height:26px;"></div>
      <div style="font-size:9.5pt;font-weight:bold;text-transform:uppercase;padding-top:4px;">${esc(AUTHORISED_BY)}</div>
      <div style="font-size:8pt;color:#64748b;">Authorised by</div>
    </td>
  </tr>
</table>

<div style="margin-top:18px;padding-top:6px;border-top:1px solid #e2e8f0;text-align:center;font-size:7.5pt;color:#94a3b8;">
  System-generated payslip &middot; Payroll Klassic
</div>

</body>
</html>`;
}

export function downloadPayslipWord(doc: PayslipDoc, result: PayrollResult): void {
  const html = payslipHtml(doc, result);
  // The BOM keeps the peso sign intact when Word guesses the encoding.
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  saveBlob(blob, payslipFilename(doc, "doc"));
}

/* ----------------------------------- pdf ---------------------------------- */

/**
 * Rasterises the on-screen payslip onto A4.
 *
 * `element` must be the white card (the `.print-area` node), not the page, so
 * the buttons and the page background stay out of the file.
 */
export async function downloadPayslipPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    logging: false,
    useCORS: true,
    windowWidth: element.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const margin = 28;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // How many source pixels fit on one page once the width is scaled down.
  const pxPerPoint = canvas.width / usableWidth;
  const pageSlice = Math.floor(usableHeight * pxPerPoint);

  let offset = 0;
  while (offset < canvas.height) {
    const sliceHeight = Math.min(pageSlice, canvas.height - offset);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (offset > 0) pdf.addPage();
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.95),
      "JPEG",
      margin,
      margin,
      usableWidth,
      sliceHeight / pxPerPoint,
      undefined,
      "FAST"
    );

    offset += sliceHeight;
  }

  pdf.save(filename);
}
