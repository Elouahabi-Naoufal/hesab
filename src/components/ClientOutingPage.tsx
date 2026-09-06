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
  inviteToOutingAction, removeOutingParticipantAction, requestLeaveOutingAction, activateOutingAction,
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
      {hasError && <div className="mt-1 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs">{state.error}</div>}
    </form>
  );
}

export default function ClientOutingPage({
  groupId, outingId, isOwner, sessionUserId,
  participants, usersMap, groupMembers, activities, activityStats,
  memberBalances, totalResponsibility, totalPaid, allActivitiesClosed, hasSettlement, outing,
}: {
  groupId: string; outingId: string; isOwner: boolean; sessionUserId: string;
  participants: any[]; usersMap: Map<string, string>; groupMembers: any[];
  activities: any[]; activityStats: any[]; memberBalances: any[];
  totalResponsibility: number; totalPaid: number; allActivitiesClosed: boolean;
  hasSettlement: boolean; outing: any;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href={`/groups/${groupId}`} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</a>
          <div className="flex-1">
            <h1 className="font-semibold">🎯 {outing.name}</h1>
            <p className="text-xs text-zinc-500">{outing.status} • {participants.length} participants • {activities.length} activities</p>
          </div>
          {isOwner && outing.status === "PLANNING" && (
            <WForm action={async () => await activateOutingAction(outingId)} initialState={{}}>
              <button className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium">Activate</button>
            </WForm>
          )}
          {isOwner && allActivitiesClosed && outing.status !== "SETTLED" && !hasSettlement && (
            <a href={`/groups/${groupId}/outings/${outingId}/settlement`} className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-medium">Settle Outing</a>
          )}
          {isOwner && outing.status === "SETTLED" && (
            <span className="px-4 py-2 rounded-full bg-zinc-800 text-white text-sm font-medium">Settled ✓</span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">💰 Live Balances</h3>
          <div className="text-xs text-zinc-500 mb-2">Total responsibility: {formatDH(totalResponsibility)} • Total paid: {formatDH(totalPaid)} • Net difference: {formatDH(totalResponsibility - totalPaid)}</div>
          <div className="space-y-2">
            {memberBalances.filter((b: any) => b.netBalance !== 0).map((b: any) => (
              <div key={b.userId} className={`flex justify-between p-3 rounded-xl text-sm ${b.netBalance > 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"}`}>
                <span>{b.displayName}</span>
                <span className="font-medium">{b.netBalance > 0 ? `+${formatDH(b.netBalance)}` : formatDH(b.netBalance)} DH</span>
              </div>
            ))}
            {memberBalances.filter((b: any) => b.netBalance === 0).length > 0 && (
              <div className="text-xs text-zinc-400">{memberBalances.filter((b: any) => b.netBalance === 0).length} person(s) balanced</div>
            )}
            {memberBalances.filter((b: any) => b.netBalance !== 0).length === 0 && (
              <div className="text-center py-4 text-sm text-zinc-500">Everyone is settled up!</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {participants.map((p: any) => (
              <span key={p.id} className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm">
                {p.user.displayName} {p.role === "OWNER" && <span className="text-xs text-amber-600">(owner)</span>}
                {isOwner && p.userId !== sessionUserId && (
                  <WForm action={async (prevState, formData) => await removeOutingParticipantAction(outingId, p.userId)} initialState={{}} className="inline ml-1">
                    <button type="submit" className="text-red-500 hover:underline text-xs">✕</button>
                  </WForm>
                )}
              </span>
            ))}
          </div>
          {!isOwner && (
            <WForm action={async () => await requestLeaveOutingAction(outingId)} initialState={{}}>
              <button type="submit" className="text-xs text-red-600 hover:underline">Leave outing</button>
            </WForm>
          )}
          {isOwner && (
            <WForm action={async (prevState, formData) => {
              const userId = formData.get("userId") as string;
              return await inviteToOutingAction(outingId, userId);
            }} initialState={{}} className="flex gap-2 mt-2">
              <select name="userId" className="flex-1 px-3 py-2 rounded-xl border text-sm bg-zinc-50 dark:bg-zinc-800">
                <option value="">Invite group member...</option>
                {groupMembers.map((p: any) => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <button type="submit" className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm">Invite</button>
            </WForm>
          )}
          {isOwner && outing.publicToken && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <QrInvite token={outing.publicToken} type="outing" name={outing.name} />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="font-semibold">Activities</h3>
          {activities.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl"><p className="text-sm text-zinc-500">No activities yet.</p></div>
          ) : (
            <div className="space-y-4">
              {activityStats.map((a: any) => (
                <ActivityCard key={a.id} activity={a} outingId={outingId} groupId={groupId} isOwner={isOwner} participants={participants} usersMap={usersMap} userId={sessionUserId} />
              ))}
            </div>
          )}

          {isOwner && outing.status !== "SETTLED" && (
            <WForm action={async (prevState, formData) => await createActivityAction(formData)} initialState={{}} className="space-y-3 mt-3">
              <input type="hidden" name="outingId" value={outingId} />
              <input name="name" placeholder="Pool / Restaurant / InDrive" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
              <select name="pricingModel" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
                <option value="FIXED">FIXED — per-unit pricing</option>
                <option value="VARIABLE">VARIABLE — custom items</option>
              </select>
              <input name="notes" placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
              <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Create Activity</button>
            </WForm>
          )}
        </div>

        {hasSettlement && (
          <a href={`/groups/${groupId}/outings/${outingId}/settlement`} className="block w-full py-3 rounded-2xl bg-amber-500 text-white text-center font-medium">View Settlement Details</a>
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
    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium text-sm">
            {isFixed ? "🎲" : "📝"} {activity.name}
            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{activity.pricingModel}</span>
            <span className={`ml-1 text-xs px-2 py-0.5 rounded ${activity.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"}`}>{activity.status}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Responsibility: {formatDH(activity.responsibility)} • Paid: {formatDH(activity.paid)} • Balance: {formatDH(activity.balance)}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {canEdit && (
            <>
              <WForm action={async () => await closeActivityAction(activity.id)} initialState={{}}>
                <button type="submit" className="text-xs text-amber-600 hover:underline px-2 py-1 rounded border">Close</button>
              </WForm>
              <WForm action={async () => await deleteActivityAction(activity.id)} initialState={{}}>
                <button type="submit" className="text-xs text-red-600 hover:underline px-2 py-1 rounded border">Delete</button>
              </WForm>
            </>
          )}
        </div>
      </div>

      {isFixed && (
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-zinc-400 mb-1">Products</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {activity.products.map((p: any) => (
                <span key={p.id} className="px-2 py-1 rounded bg-white dark:bg-zinc-900 text-xs">
                  {p.name} — {formatDH(p.pricePerUnitCt)}/{p.unit}
                  {canEdit && (
                    <>
                      <details className="inline">
                        <summary className="inline cursor-pointer text-blue-500 hover:underline ml-1">✏</summary>
                        <WForm action={async (prevState, formData) => {
                          return await updateActivityProductAction(p.id, {
                            name: formData.get("name") as string || undefined,
                            unit: formData.get("unit") as string || undefined,
                            pricePerUnitDH: formData.get("pricePerUnitDH") as string || undefined,
                          });
                        }} initialState={{}} className="absolute z-10 mt-1 p-2 rounded bg-white dark:bg-zinc-800 border shadow-lg space-y-1">
                          <input name="name" defaultValue={p.name} placeholder="Name" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="unit" defaultValue={p.unit} placeholder="Unit" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="pricePerUnitDH" defaultValue={(p.pricePerUnitCt / 100).toFixed(2)} placeholder="Price (DH)" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <button type="submit" className="px-2 py-0.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Save</button>
                        </WForm>
                      </details>
                      <WForm action={async () => await deleteActivityProductAction(p.id)} initialState={{}} className="ml-1 inline">
                        <button type="submit" className="text-red-500 hover:underline">✕</button>
                      </WForm>
                    </>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                <summary className="text-xs cursor-pointer text-zinc-500">+ Add Product</summary>
                <WForm action={async (prevState, formData) => await createActivityProductAction(formData)} initialState={{}} className="space-y-2 mt-2">
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input name="name" placeholder="Product name" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <input name="unit" placeholder="Unit (game, hour, etc.)" className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <input name="pricePerUnitDH" placeholder="Price per unit (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Product</button>
                </WForm>
              </details>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-400 mb-1">Usage Records</div>
            {activity.usageRecords.map((r: any) => (
              <div key={r.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900 mb-1">
                <div className="flex justify-between">
                  <span>{r.quantity} × {activity.products.find((p: any) => p.id === r.productId)?.name || "?"} = {formatDH(r.totalCentimes)} ({r.participants.length} people)</span>
                  <span className={`px-1 rounded ${r.status === "CONFIRMED" ? "bg-green-100 text-green-700" : r.status === "DISPUTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{r.status}</span>
                </div>
                <div className="text-zinc-500 mt-1">
                  Participants: {r.participants.map((pp: any) => usersMap.get(pp.userId) || pp.userId).join(", ")}
                </div>
                {r.status !== "CONFIRMED" && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <WForm action={async () => await confirmUsageRecordAction(r.id)} initialState={{}}>
                      <button type="submit" className="text-xs text-green-600 hover:underline px-2 py-0.5 rounded border">Confirm</button>
                    </WForm>
                    <WForm action={async (prevState, formData) => {
                      const notes = formData.get("notes") as string;
                      return await disputeUsageRecordAction(r.id, notes);
                    }} initialState={{}}>
                      <button type="submit" className="text-xs text-red-600 hover:underline px-2 py-0.5 rounded border">Dispute</button>
                    </WForm>
                    {isOwner && r.participants.filter((pp: any) => {
                      const conf = r.confirmations.find((c: any) => c.userId === pp.userId);
                      return conf && conf.status === "PENDING";
                    }).map((pp: any) => (
                      <WForm key={pp.userId} action={async () => await adminConfirmUsageRecordAction(r.id, pp.userId)} initialState={{}}>
                        <button type="submit" className="text-xs text-blue-600 hover:underline px-2 py-0.5 rounded border" title={`Confirm on behalf of ${usersMap.get(pp.userId) || pp.userId}`}>✓ {usersMap.get(pp.userId) || pp.userId}</button>
                      </WForm>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <div className="flex gap-2 mt-1">
                    <details className="inline">
                      <summary className="inline cursor-pointer text-blue-500 hover:underline text-xs">Edit</summary>
                      <WForm action={async (prevState, formData) => {
                        const qty = parseInt(formData.get("quantity") as string, 10);
                        return await updateUsageRecordAction(r.id, { quantity: qty });
                      }} initialState={{}} className="inline-flex gap-1 items-center ml-1">
                        <input name="quantity" type="number" min="1" defaultValue={r.quantity} className="w-16 px-1 py-0.5 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                        <button type="submit" className="text-xs text-blue-600 hover:underline">Save</button>
                      </WForm>
                    </details>
                    <WForm action={async () => await deleteUsageRecordAction(r.id)} initialState={{}}>
                      <button type="submit" className="text-xs text-red-500 hover:underline">Delete</button>
                    </WForm>
                  </div>
                )}
              </div>
            ))}
            {canEdit && (
              <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
                <summary className="text-xs cursor-pointer text-zinc-500">+ Record Usage</summary>
                <WForm action={async (prevState, formData) => await createUsageRecordAction(formData)} initialState={{}} className="space-y-2 mt-2">
                  <input type="hidden" name="activityId" value={activity.id} />
                  <select name="productId" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800">
                    <option value="">Select product...</option>
                    {activity.products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({formatDH(p.pricePerUnitCt)}/{p.unit})</option>)}
                  </select>
                  <input name="quantity" type="number" min="1" placeholder="Quantity" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <div className="text-xs text-zinc-500">Select participants:</div>
                  {participants.map((p: any) => (
                    <label key={p.userId} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="participantIds" value={p.userId} /> {p.user.displayName}
                    </label>
                  ))}
                  <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Record Usage</button>
                </WForm>
              </details>
            )}
          </div>
        </div>
      )}

      {isVariable && (
        <div>
          <div className="text-xs font-medium text-zinc-400 mb-1">Items</div>
          {activity.lineItems.map((l: any) => {
            const canEditItem = l.userId === userId || isOwner;
            return (
              <div key={l.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900 mb-1 flex justify-between">
                <span>{usersMap.get(l.userId) || "?"}: {l.description} — {formatDH(l.priceCentimes)}</span>
                <div className="flex gap-2 items-center">
                  {canEditItem && canEdit && (
                    <>
                      <details className="inline">
                        <summary className="inline cursor-pointer text-blue-500 hover:underline">✏</summary>
                        <WForm action={async (prevState, formData) => {
                          return await updateLineItemAction(l.id, {
                            description: formData.get("description") as string || undefined,
                            priceDH: formData.get("priceDH") as string || undefined,
                          });
                        }} initialState={{}} className="absolute z-10 mt-1 p-2 rounded bg-white dark:bg-zinc-800 border shadow-lg space-y-1">
                          <input name="description" defaultValue={l.description} placeholder="Description" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="priceDH" defaultValue={(l.priceCentimes / 100).toFixed(2)} placeholder="Price (DH)" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <button type="submit" className="px-2 py-0.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Save</button>
                        </WForm>
                      </details>
                      <WForm action={async () => await deleteLineItemAction(l.id)} initialState={{}}>
                        <button type="submit" className="text-red-500 hover:underline">✕</button>
                      </WForm>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {activity.lineItems.length === 0 && <div className="text-xs text-zinc-500 italic">No items yet</div>}
          {canEdit && (
            <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
              <summary className="text-xs cursor-pointer text-zinc-500">+ Add Item</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2 mt-2">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" defaultValue={userId} className="hidden" />
                <input name="description" placeholder="What was consumed?" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <input name="priceDH" placeholder="Price (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Item</button>
              </WForm>
            </details>
          )}
          {!isOwner && activity.status === "OPEN" && (
            <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
              <summary className="text-xs cursor-pointer text-zinc-500">+ Add My Item</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2 mt-2">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" value={userId} className="hidden" />
                <input name="description" placeholder="What did you consume?" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <input name="priceDH" placeholder="Price (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Item</button>
              </WForm>
            </details>
          )}
        </div>
      )}

      <div>
        <div className="text-xs font-medium text-zinc-400 mb-1">Payments</div>
        {activity.payments.map((p: any) => (
          <div key={p.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900 mb-1 flex justify-between">
            <span>{usersMap.get(p.userId) || "?"}: {formatDH(p.amountCentimes)}</span>
            {canEdit && (
              <>
                <details className="inline">
                  <summary className="inline cursor-pointer text-blue-500 hover:underline">✏</summary>
                  <WForm action={async (prevState, formData) => {
                    return await updateActivityPaymentAction(p.id, formData.get("amountDH") as string);
                  }} initialState={{}} className="inline-flex gap-1 items-center ml-1">
                    <input name="amountDH" defaultValue={(p.amountCentimes / 100).toFixed(2)} placeholder="Amount (DH)" className="w-20 px-1 py-0.5 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                    <button type="submit" className="text-xs text-blue-600 hover:underline">Save</button>
                  </WForm>
                </details>
                <WForm action={async () => await deleteActivityPaymentAction(p.id)} initialState={{}}>
                  <button type="submit" className="text-red-500 hover:underline">✕</button>
                </WForm>
              </>
            )}
          </div>
        ))}
        {canEdit && (
          <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
            <summary className="text-xs cursor-pointer text-zinc-500">+ Record Payment</summary>
            <WForm action={async (prevState, formData) => await recordActivityPaymentAction(formData)} initialState={{}} className="space-y-2 mt-2">
              <input type="hidden" name="activityId" value={activity.id} />
              <select name="userId" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800">
                <option value="">Who paid?</option>
                {participants.map((p: any) => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <input name="amountDH" placeholder="Amount (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
              <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Record Payment</button>
            </WForm>
          </details>
        )}
      </div>
    </div>
  );
}
