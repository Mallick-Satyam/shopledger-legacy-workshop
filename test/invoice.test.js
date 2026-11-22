const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice total and GST breakdown match billed totals for an HSN-rated order', () => {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.equal(invoiceFigures.rows[0].gstPercent, billed.lines[0].gstPercent);
  assert.equal(invoiceFigures.rows[0].lineTax, billed.lines[0].tax);
});

test('invoice uses the billed coupon cap and taxes the discounted HSN amount', () => {
  const items = [{ id: 2, name: 'Rice', hsn: '1006', price: 3000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.tax, 142.5);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 142.5);
  assert.equal(invoiceFigures.total, 2992.5);
});

test('GST reconciliation matches billed order figures using in-memory data', () => {
  const items = [{ id: 3, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const db = {
    orders: [{
      id: 9001,
      date: '22/11/2026',
      customer: 'Test Customer',
      coupon: 'SAVE10',
      status: 'completed',
      items,
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].invoiceTax, billed.tax);
  assert.equal(reconciliation.rows[0].invoiceTotal, billed.total);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
