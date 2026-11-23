import { recordPayment } from "@/lib/payments/actions";

export function PaymentForm({ tenantId, payableType, payableId, remaining, currency, back, mobileEnabled, defaultPayer }: {
  tenantId: string; payableType: string; payableId?: string; remaining: number; currency: string; back: string; mobileEnabled: boolean; defaultPayer?: string;
}) {
  return (
    <form action={recordPayment} className="space-y-3">
      <input type="hidden" name="tenant" value={tenantId} />
      <input type="hidden" name="payable_type" value={payableType} />
      {payableId && <input type="hidden" name="payable_id" value={payableId} />}
      <input type="hidden" name="back" value={back} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Montant</label><input name="amount" type="number" step="0.01" min="0.01" defaultValue={remaining > 0 ? remaining : ""} required className="input" /></div>
        <div><label className="label">Devise</label>
          <select name="currency" defaultValue={currency} className="input"><option value="USD">USD</option><option value="CDF">CDF</option></select></div>
      </div>
      <div><label className="label">Moyen de paiement</label>
        <select name="method" className="input" defaultValue="cash">
          <option value="cash">💵 Espèces (caisse)</option>
          <option value="orange_money" disabled={!mobileEnabled}>🟠 Orange Money</option>
          <option value="airtel_money" disabled={!mobileEnabled}>🔴 Airtel Money</option>
          <option value="mpesa" disabled={!mobileEnabled}>🟢 M-Pesa</option>
        </select></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Payeur</label><input name="payer_name" defaultValue={defaultPayer} className="input" /></div>
        <div><label className="label">N° Mobile Money</label><input name="payer_phone" type="tel" placeholder="08X XXX XXXX" className="input" /></div>
      </div>
      <button className="btn-primary w-full">Encaisser</button>
      <p className="text-xs text-slate-400">Mobile Money : le client confirme sur son téléphone ; le paiement n&apos;est validé qu&apos;après confirmation de l&apos;opérateur.</p>
    </form>
  );
}
