"use client";
import { useActionState } from "react";
import { formatDH } from "@/lib/utils";
import {
  createActivityAction, closeActivityAction, deleteActivityAction,
} from "@/server/activities/actions";
import {
  createActivityProductAction, updateActivityProductAction, deleteActivityProductAction,
} from "@/server/products/actions";
import {
  createUsageRecordAction, updateUsageRecordAction, deleteUsageRecordAction,
  confirmUsageRecordAction, disputeUsageRecordAction, adminConfirmUsageRecordAction,
} from "@/server/usage/actions";
import {
  createLineItemAction, updateLineItemAction, deleteLineItemAction,
} from "@/server/lineitems/actions";
import {
  recordActivityPaymentAction, updateActivityPaymentAction, deleteActivityPaymentAction,
} from "@/server/payments/actions";
import {
  removeOutingParticipantAction, requestLeaveOutingAction, activateOutingAction,
} from "@/server/outings/actions";
import QrInvite from "@/components/QrInvite";

type AR = { error?: string };

function WForm({ action, initialState, children, className }: {
  action: (prevState: AR, formData: FormData) => Promise<AR>;
  initialState: AR;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const hasError = state && state.error;
  return (
    <form action={formAction} className={className}>
      {children}
      {hasError && <div className="mt-2 p-2.5 rounded-[10px] bg-danger-subtle border border-danger/20 text-danger text-[13px]">{state.error}</div>}
    </form>
  );
}

export default function ClientOutingPage({
  groupId, outingId, isOwner, sessionUserId,
  participants, usersMap, activities, activityStats,
  memberBalances, totalResponsibility, totalPaid, allActivitiesClosed, hasSettlement, outing,
}: {
  groupId: string; outingId: string; isOwner: boolean; sessionUserId: string;
  participants: any[]; usersMap: Map<string, string>; activities: any[]; activityStats: any[]; memberBalances: any[];
  totalResponsibility: number; totalPaid: number; allActivitiesClosed: boolean;
  hasSettlement: boolean; outing: any;
}) {
  const netDiff = totalResponsibility - totalPaid;

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <a href={`/groups/${groupId}`} className="p-2 rounded-[10px] hover:bg-elevated transition text-muted">←</a>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[18px] truncate">{outing.name}</h1>
            <p className="text-[13px] text-muted">{outing.status} · {participants.length} participants · {activities.length} activities</p>
          </div>
          {isOwner && outing.status === "PLANNING" && (
            <WForm action={async () => await activateOutingAction(outingId)} initialState={{}}>
              <button className="btn-primary text-[13px]">Activate</button>
            </WForm>
          )}
          {isOwner && allActivitiesClosed && outing.status !== "SETTLED" && !hasSettlement && (
            <a href={`/groups/${groupId}/outings/${outingId}/settlement`} className="btn-settle text-[13px] px-4 py-2 rounded-[10px]">Settle Outing</a>
          )}
          {isOwner && outing.status === "SETTLED" && (
            <span className="tag bg-success-subtle text-success">Settled ✓</span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        {/* Live Balances — financial hero */}
        <div className="card-elevated p-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-[13px] text-muted mb-1">Live Balances</div>
              <div className="money text-[32px] font-bold tracking-tight">
                {formatDH(totalPaid)} <span className="text-[16px] font-medium text-muted">DH paid</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] text-muted">Net difference</div>
              <div className={`money text-[20px] font-bold ${netDiff > 0 ? "text-success" : netDiff < 0 ? "text-danger" : "text-muted"}`}>
                {netDiff > 0 ? "+" : ""}{formatDH(netDiff)} DH
              </div>
            </div>
          </div>
          <div className="h-px bg-border mb-4"></div>
          <div className="space-y-2">
            {memberBalances.filter((b: any) => b.netBalance !== 0).map((b: any) => (
              <div key={b.userId} className="flex items-center justify-between py-2">
                <span className="text-[14px]">{b.displayName}</span>
                <span className={`money text-[15px] font-semibold ${b.netBalance > 0 ? "text-success" : "text-danger"}`}>
                  {b.netBalance > 0 ? "+" : ""}{formatDH(b.netBalance)} DH
                </span>
              </div>
            ))}
            {memberBalances.filter((b: any) => b.netBalance === 0).length > 0 && (
              <div className="text-[12px] text-muted pt-1">{memberBalances.filter((b: any) => b.netBalance === 0).length} person(s) balanced</div>
            )}
            {memberBalances.filter((b: any) => b.netBalance !== 0).length === 0 && (
              <div className="text-center py-3 text-[14px] text-muted">Everyone is settled up!</div>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="card-elevated p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {participants.map((p: any) => (
              <span key={p.id} className="tag bg-elevated text-foreground">
                {p.user.displayName}
                {p.role === "OWNER" && <span className="text-brand ml-1">★</span>}
                {isOwner && p.userId !== sessionUserId && (
                  <WForm action={async () => await removeOutingParticipantAction(outingId, p.userId)} initialState={{}} className="inline ml-1">
                    <button type="submit" className="text-danger hover:opacity-70 ml-0.5">×</button>
                  </WForm>
                )}
              </span>
            ))}
          </div>
          {!isOwner && (
            <WForm action={async () => await requestLeaveOutingAction(outingId)} initialState={{}}>
              <button type="submit" className="text-[12px] text-danger hover:underline">Leave outing</button>
            </WForm>
          )}
          {isOwner && outing.publicToken && (
            <div className="pt-3 mt-1 border-t border-border">
              <QrInvite token={outing.publicToken} type="outing" name={outing.name} />
            </div>
          )}
        </div>

        {/* Activities */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold">Activities</h2>
          </div>
          {activities.length === 0 ? (
            <div className="card border-dashed p-10 text-center">
              <div className="text-3xl mb-2 opacity-30">📝</div>
              <p className="text-[14px] text-muted">No activities yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityStats.map((a: any) => (
                <ActivityCard key={a.id} activity={a} outingId={outingId} groupId={groupId} isOwner={isOwner} participants={participants} usersMap={usersMap} userId={sessionUserId} />
              ))}
            </div>
          )}

          {isOwner && outing.status !== "SETTLED" && (
            <div className="card-elevated p-5">
              <h3 className="text-[14px] font-semibold mb-3">New Activity</h3>
              <WForm action={async (prevState, formData) => await createActivityAction(formData)} initialState={{}} className="space-y-3">
                <input type="hidden" name="outingId" value={outingId} />
                <input name="name" placeholder="Pool / Restaurant / InDrive" required className="input" />
                <select name="pricingModel" className="input">
                  <option value="FIXED">FIXED — per-unit pricing</option>
                  <option value="VARIABLE">VARIABLE — custom items</option>
                </select>
                <input name="notes" placeholder="Notes (optional)" className="input" />
                <button className="btn-primary w-full py-2.5">Create Activity</button>
              </WForm>
            </div>
          )}
        </div>

        {hasSettlement && (
          <a href={`/groups/${groupId}/outings/${outingId}/settlement`} className="btn-settle w-full py-3 text-[15px] font-medium text-center block rounded-[14px]">View Settlement</a>
        )}
      </main>
    </div>
  );
}

function ActivityCard({ activity, outingId, groupId, isOwner, participants, usersMap, userId }: {
  activity: any; outingId: string; groupId: string; isOwner: boolean;
  participants: any[]; usersMap: Map<string, string>; userId: string;
}) {
  const isFixed = activity.pricingModel === "FIXED";
  const isVariable = activity.pricingModel === "VARIABLE";
  const canEdit = isOwner && activity.status === "OPEN";

  return (
    <div className="card-elevated p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold">{activity.name}</span>
            <span className="tag bg-elevated text-muted">{activity.pricingModel}</span>
            <span className={`tag ${activity.status === "OPEN" ? "bg-success-subtle text-success" : "bg-elevated text-muted"}`}>
              <span className={`status-dot ${activity.status === "OPEN" ? "bg-success" : "bg-muted"}`}></span>
              {activity.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[13px] text-muted">
            <span>Responsibility: <span className="money font-medium text-foreground">{formatDH(activity.responsibility)} DH</span></span>
            <span>Paid: <span className="money font-medium text-foreground">{formatDH(activity.paid)} DH</span></span>
            <span className={activity.balance !== 0 ? (activity.balance > 0 ? "text-success" : "text-danger") : ""}>
              Balance: <span className="money font-medium">{formatDH(activity.balance)} DH</span>
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1.5 flex-shrink-0">
            <WForm action={async () => await closeActivityAction(activity.id)} initialState={{}}>
              <button type="submit" className="btn-ghost text-[12px] text-warn">Close</button>
            </WForm>
            <WForm action={async () => await deleteActivityAction(activity.id)} initialState={{}}>
              <button type="submit" className="btn-ghost text-[12px] text-danger">Delete</button>
            </WForm>
          </div>
        )}
      </div>

      {/* FIXED: Products */}
      {isFixed && (
        <div className="space-y-3">
          {activity.products.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-muted mb-2">Products</div>
              <div className="space-y-1">
                {activity.products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-elevated">
                    <span className="text-[14px]">{p.name} <span className="text-muted">· {formatDH(p.pricePerUnitCt)}/{p.unit}</span></span>
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <details className="relative">
                          <summary className="cursor-pointer text-brand text-[12px] hover:underline">Edit</summary>
                          <WForm action={async (prevState, formData) => {
                            return await updateActivityProductAction(p.id, {
                              name: formData.get("name") as string || undefined,
                              unit: formData.get("unit") as string || undefined,
                              pricePerUnitDH: formData.get("pricePerUnitDH") as string || undefined,
                            });
                          }} initialState={{}} className="absolute right-0 z-10 mt-1 p-3 rounded-[14px] bg-surface border border-border shadow-lg space-y-2 w-56">
                            <input name="name" defaultValue={p.name} placeholder="Name" className="input text-[13px] py-1.5" />
                            <input name="unit" defaultValue={p.unit} placeholder="Unit" className="input text-[13px] py-1.5" />
                            <input name="pricePerUnitDH" defaultValue={(p.pricePerUnitCt / 100).toFixed(2)} placeholder="Price (DH)" className="input text-[13px] py-1.5" />
                            <button type="submit" className="btn-primary w-full py-1.5 text-[12px]">Save</button>
                          </WForm>
                        </details>
                        <WForm action={async () => await deleteActivityProductAction(p.id)} initialState={{}} className="inline">
                          <button type="submit" className="text-danger text-[12px] hover:underline">✕</button>
                        </WForm>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {canEdit && (
            <details className="rounded-[14px] border border-border p-3">
              <summary className="text-[13px] cursor-pointer text-muted font-medium">+ Add Product</summary>
              <WForm action={async (prevState, formData) => await createActivityProductAction(formData)} initialState={{}} className="space-y-2 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input name="name" placeholder="Product name" required className="input text-[13px]" />
                <input name="unit" placeholder="Unit (game, hour, etc.)" className="input text-[13px]" />
                <input name="pricePerUnitDH" placeholder="Price per unit (DH)" required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">Add Product</button>
              </WForm>
            </details>
          )}

          {/* Usage Records */}
          {activity.usageRecords.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-muted mb-2">Usage</div>
              <div className="space-y-2">
                {activity.usageRecords.map((r: any) => (
                  <div key={r.id} className="rounded-[10px] bg-elevated p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px]">
                        {r.quantity} × {activity.products.find((p: any) => p.id === r.productId)?.name || "?"}
                        <span className="text-muted"> = <span className="money font-semibold">{formatDH(r.totalCentimes)} DH</span></span>
                      </span>
                      <span className={`tag text-[11px] ${r.status === "CONFIRMED" ? "bg-success-subtle text-success" : r.status === "DISPUTED" ? "bg-danger-subtle text-danger" : "bg-warn-subtle text-warn"}`}>
                        <span className={`status-dot ${r.status === "CONFIRMED" ? "bg-success" : r.status === "DISPUTED" ? "bg-danger" : "bg-warn"}`}></span>
                        {r.status}
                      </span>
                    </div>
                    <div className="text-[12px] text-muted">
                      {r.participants.map((pp: any) => usersMap.get(pp.userId) || pp.userId).join(", ")}
                    </div>
                    {r.status !== "CONFIRMED" && (
                      <div className="flex gap-2 flex-wrap">
                        <WForm action={async () => await confirmUsageRecordAction(r.id)} initialState={{}}>
                          <button type="submit" className="btn-ghost text-[12px] text-success">Confirm</button>
                        </WForm>
                        <WForm action={async (prevState, formData) => {
                          const notes = formData.get("notes") as string;
                          return await disputeUsageRecordAction(r.id, notes);
                        }} initialState={{}}>
                          <button type="submit" className="btn-ghost text-[12px] text-danger">Dispute</button>
                        </WForm>
                        {isOwner && r.participants.filter((pp: any) => {
                          const conf = r.confirmations.find((c: any) => c.userId === pp.userId);
                          return conf && conf.status === "PENDING";
                        }).map((pp: any) => (
                          <WForm key={pp.userId} action={async () => await adminConfirmUsageRecordAction(r.id, pp.userId)} initialState={{}}>
                            <button type="submit" className="btn-ghost text-[12px] text-brand" title={`Confirm on behalf of ${usersMap.get(pp.userId) || pp.userId}`}>
                              ✓ {usersMap.get(pp.userId) || pp.userId}
                            </button>
                          </WForm>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex gap-2 items-center pt-1">
                        <details className="relative">
                          <summary className="cursor-pointer text-brand text-[12px] hover:underline">Edit</summary>
                          <WForm action={async (prevState, formData) => {
                            const qty = parseInt(formData.get("quantity") as string, 10);
                            return await updateUsageRecordAction(r.id, { quantity: qty });
                          }} initialState={{}} className="absolute left-0 z-10 mt-1 p-3 rounded-[14px] bg-surface border border-border shadow-lg flex gap-2 items-center">
                            <input name="quantity" type="number" min="1" defaultValue={r.quantity} className="input text-[13px] py-1.5 w-20" />
                            <button type="submit" className="btn-primary py-1.5 px-3 text-[12px]">Save</button>
                          </WForm>
                        </details>
                        <WForm action={async () => await deleteUsageRecordAction(r.id)} initialState={{}}>
                          <button type="submit" className="text-[12px] text-danger hover:underline">Delete</button>
                        </WForm>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {canEdit && (
            <details className="rounded-[14px] border border-border p-3">
              <summary className="text-[13px] cursor-pointer text-muted font-medium">+ Record Usage</summary>
              <WForm action={async (prevState, formData) => await createUsageRecordAction(formData)} initialState={{}} className="space-y-2 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <select name="productId" required className="input text-[13px]">
                  <option value="">Select product...</option>
                  {activity.products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({formatDH(p.pricePerUnitCt)}/{p.unit})</option>)}
                </select>
                <input name="quantity" type="number" min="1" placeholder="Quantity" required className="input text-[13px]" />
                <div className="text-[12px] text-muted">Select participants:</div>
                <div className="space-y-1">
                  {participants.map((p: any) => (
                    <label key={p.userId} className="flex items-center gap-2 text-[13px] py-1 cursor-pointer">
                      <input type="checkbox" name="participantIds" value={p.userId} className="accent-brand" />
                      {p.user.displayName}
                    </label>
                  ))}
                </div>
                <button className="btn-primary w-full py-2 text-[13px]">Record Usage</button>
              </WForm>
            </details>
          )}
        </div>
      )}

      {/* VARIABLE: Line Items */}
      {isVariable && (
        <div className="space-y-3">
          {activity.lineItems.length > 0 && (
            <div>
              <div className="text-[12px] font-medium text-muted mb-2">Items</div>
              <div className="space-y-1">
                {activity.lineItems.map((l: any) => {
                  const canEditItem = l.userId === userId || isOwner;
                  return (
                    <div key={l.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-elevated">
                      <span className="text-[14px]">{usersMap.get(l.userId) || "?"}: {l.description} <span className="money font-medium">{formatDH(l.priceCentimes)} DH</span></span>
                      {canEditItem && canEdit && (
                        <div className="flex items-center gap-1">
                          <details className="relative">
                            <summary className="cursor-pointer text-brand text-[12px] hover:underline">Edit</summary>
                            <WForm action={async (prevState, formData) => {
                              return await updateLineItemAction(l.id, {
                                description: formData.get("description") as string || undefined,
                                priceDH: formData.get("priceDH") as string || undefined,
                              });
                            }} initialState={{}} className="absolute right-0 z-10 mt-1 p-3 rounded-[14px] bg-surface border border-border shadow-lg space-y-2 w-56">
                              <input name="description" defaultValue={l.description} placeholder="Description" className="input text-[13px] py-1.5" />
                              <input name="priceDH" defaultValue={(l.priceCentimes / 100).toFixed(2)} placeholder="Price (DH)" className="input text-[13px] py-1.5" />
                              <button type="submit" className="btn-primary w-full py-1.5 text-[12px]">Save</button>
                            </WForm>
                          </details>
                          <WForm action={async () => await deleteLineItemAction(l.id)} initialState={{}}>
                            <button type="submit" className="text-danger text-[12px] hover:underline">✕</button>
                          </WForm>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activity.lineItems.length === 0 && <div className="text-[13px] text-muted italic">No items yet</div>}
          {canEdit && (
            <details className="rounded-[14px] border border-border p-3">
              <summary className="text-[13px] cursor-pointer text-muted font-medium">+ Add Item</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" defaultValue={userId} className="hidden" />
                <input name="description" placeholder="What was consumed?" required className="input text-[13px]" />
                <input name="priceDH" placeholder="Price (DH)" required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">Add Item</button>
              </WForm>
            </details>
          )}
          {!isOwner && activity.status === "OPEN" && (
            <details className="rounded-[14px] border border-border p-3">
              <summary className="text-[13px] cursor-pointer text-muted font-medium">+ Add My Item</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" value={userId} className="hidden" />
                <input name="description" placeholder="What did you consume?" required className="input text-[13px]" />
                <input name="priceDH" placeholder="Price (DH)" required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">Add Item</button>
              </WForm>
            </details>
          )}
        </div>
      )}

      {/* Payments */}
      <div className="space-y-2">
        <div className="text-[12px] font-medium text-muted">Payments</div>
        {activity.payments.length > 0 && (
          <div className="space-y-1">
            {activity.payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-elevated">
                <span className="text-[14px]">{usersMap.get(p.userId) || "?"} <span className="money font-semibold">{formatDH(p.amountCentimes)} DH</span></span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <details className="relative">
                      <summary className="cursor-pointer text-brand text-[12px] hover:underline">Edit</summary>
                      <WForm action={async (prevState, formData) => {
                        return await updateActivityPaymentAction(p.id, formData.get("amountDH") as string);
                      }} initialState={{}} className="absolute right-0 z-10 mt-1 p-3 rounded-[14px] bg-surface border border-border shadow-lg flex gap-2 items-center">
                        <input name="amountDH" defaultValue={(p.amountCentimes / 100).toFixed(2)} placeholder="Amount (DH)" className="input text-[13px] py-1.5 w-24" />
                        <button type="submit" className="btn-primary py-1.5 px-3 text-[12px]">Save</button>
                      </WForm>
                    </details>
                    <WForm action={async () => await deleteActivityPaymentAction(p.id)} initialState={{}}>
                      <button type="submit" className="text-danger text-[12px] hover:underline">✕</button>
                    </WForm>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <details className="rounded-[14px] border border-border p-3">
            <summary className="text-[13px] cursor-pointer text-muted font-medium">+ Record Payment</summary>
            <WForm action={async (prevState, formData) => await recordActivityPaymentAction(formData)} initialState={{}} className="space-y-2 mt-3">
              <input type="hidden" name="activityId" value={activity.id} />
              <select name="userId" required className="input text-[13px]">
                <option value="">Who paid?</option>
                {participants.map((p: any) => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <input name="amountDH" placeholder="Amount (DH)" required className="input text-[13px]" />
              <button className="btn-primary w-full py-2 text-[13px]">Record Payment</button>
            </WForm>
          </details>
        )}
      </div>
    </div>
  );
}
