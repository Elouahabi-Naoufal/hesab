import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";
import QrInvite from "@/components/QrInvite";

export default async function OutingPage({ params, searchParams }: { params: Promise<{ id: string; outingId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id: groupId, outingId } = await params;
  const { error: errorParam } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) notFound();

  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing || outing.groupId !== groupId) notFound();

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant) return <div className="p-10 text-center">You are not a participant in this outing.</div>;

  const isOwner = participant.role === "OWNER";

  const participants = await prisma.outingParticipant.findMany({ where: { outingId }, include: { user: true } });
  const usersMap = new Map(participants.map(p => [p.userId, p.user.displayName]));
  const outingParticipantIds = new Set(participants.map(p => p.userId));

  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId, userId: { notIn: [...outingParticipantIds] } },
    include: { user: true },
  });

  const activities = await prisma.activity.findMany({
    where: { outingId },
    include: {
      products: true,
      usageRecords: { include: { participants: true, confirmations: true } },
      lineItems: true,
      payments: true,
      members: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const allActivitiesClosed = activities.length > 0 && activities.every(a => a.status === "CLOSED");
  const hasSettlement = await prisma.settlement.findFirst({ where: { outingId } });

  const activityStats = activities.map(a => {
    let responsibility = 0;
    const paid = a.payments.reduce((s, p) => s + p.amountCentimes, 0);

    if (a.pricingModel === "FIXED") {
      for (const r of a.usageRecords.filter(r => r.status !== "DISPUTED")) {
        if (r.participants.length > 0) {
          const share = Math.floor(r.totalCentimes / r.participants.length);
          responsibility += share * r.participants.length;
        }
      }
    } else {
      responsibility = a.lineItems.reduce((s, l) => s + l.priceCentimes, 0);
    }

    return { ...a, responsibility, paid, balance: paid - responsibility };
  });

  const totalResponsibility = activityStats.reduce((s, a) => s + a.responsibility, 0);
  const totalPaid = activityStats.reduce((s, a) => s + a.paid, 0);

  const memberBalances = participants.map(p => {
    const paid = activityStats.reduce((s, a) => s + a.payments.filter(pay => pay.userId === p.userId).reduce((s2, pay) => s2 + pay.amountCentimes, 0), 0);
    const resp = activityStats.reduce((s, a) => {
      if (a.pricingModel === "FIXED") {
        let myResp = 0;
        for (const r of a.usageRecords.filter(r => r.status !== "DISPUTED")) {
          const myPart = r.participants.find(pp => pp.userId === p.userId);
          if (myPart && r.participants.length > 0) {
            myResp += Math.floor(r.totalCentimes / r.participants.length);
          }
        }
        return s + myResp;
      } else {
        return s + a.lineItems.filter(l => l.userId === p.userId).reduce((s2, l) => s2 + l.priceCentimes, 0);
      }
    }, 0);
    return { userId: p.userId, displayName: p.user.displayName, totalPaid: paid, totalResponsibility: resp, netBalance: paid - resp };
  });

  const totalNet = memberBalances.reduce((s, b) => s + b.netBalance, 0);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div className="flex-1">
            <h1 className="font-semibold">🎯 {outing.name}</h1>
            <p className="text-xs text-zinc-500">{outing.status} • {participants.length} participants • {activities.length} activities</p>
          </div>
          {isOwner && outing.status === "PLANNING" && (
            <form action={async () => {
              "use server";
              const { activateOutingAction } = await import("@/server/outings/actions");
              await activateOutingAction(outingId);
            }}>
              <button className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium">Activate</button>
            </form>
          )}
          {isOwner && allActivitiesClosed && outing.status !== "SETTLED" && !hasSettlement && (
            <Link href={`/groups/${groupId}/outings/${outingId}/settlement`} className="px-4 py-2 rounded-full bg-amber-600 text-white text-sm font-medium">Settle Outing</Link>
          )}
          {isOwner && outing.status === "SETTLED" && (
            <span className="px-4 py-2 rounded-full bg-zinc-800 text-white text-sm font-medium">Settled ✓</span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {errorParam && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex justify-between items-center">
            <span>{decodeURIComponent(errorParam)}</span>
            <a href={`/groups/${groupId}/outings/${outingId}`} className="text-red-500 hover:text-red-700 ml-2 font-bold">✕</a>
          </div>
        )}
        {/* Live Balances */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">💰 Live Balances</h3>
          <div className="text-xs text-zinc-500 mb-2">Total responsibility: {formatDH(totalResponsibility)} • Total paid: {formatDH(totalPaid)} • Net difference: {formatDH(totalResponsibility - totalPaid)}</div>
          <div className="space-y-2">
            {memberBalances.filter(b => b.netBalance !== 0).map(b => (
              <div key={b.userId} className={`flex justify-between p-3 rounded-xl text-sm ${b.netBalance > 0 ? "bg-emerald-50 dark:bg-emerald-950" : "bg-red-50 dark:bg-red-950"}`}>
                <span>{b.displayName}</span>
                <span className="font-medium">{b.netBalance > 0 ? `+${formatDH(b.netBalance)}` : formatDH(b.netBalance)} DH</span>
              </div>
            ))}
            {memberBalances.filter(b => b.netBalance === 0).length > 0 && (
              <div className="text-xs text-zinc-400">{memberBalances.filter(b => b.netBalance === 0).length} person(s) balanced</div>
            )}
            {memberBalances.filter(b => b.netBalance !== 0).length === 0 && (
              <div className="text-center py-4 text-sm text-zinc-500">Everyone is settled up!</div>
            )}
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <span key={p.id} className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm">
                {p.user.displayName} {p.role === "OWNER" && <span className="text-xs text-amber-600">(owner)</span>}
                {isOwner && p.userId !== session.userId && (
                  <form action={async () => {
                    "use server";
                    const { removeOutingParticipantAction } = await import("@/server/outings/actions");
                    const res = await removeOutingParticipantAction(outingId, p.userId);
                    if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                  }} className="inline ml-1">
                    <button className="text-red-500 hover:underline text-xs">✕</button>
                  </form>
                )}
              </span>
            ))}
          </div>
          {!isOwner && (
            <form action={async () => {
              "use server";
              const { requestLeaveOutingAction } = await import("@/server/outings/actions");
              const res = await requestLeaveOutingAction(outingId);
              if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
            }}>
              <button className="text-xs text-red-600 hover:underline">Leave outing</button>
            </form>
          )}
          {isOwner && (
            <form action={async (formData: FormData) => {
              "use server";
              const { inviteToOutingAction } = await import("@/server/outings/actions");
              const userId = formData.get("userId") as string;
              const res = await inviteToOutingAction(outingId, userId);
              if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
            }} className="flex gap-2 mt-2">
              <select name="userId" className="flex-1 px-3 py-2 rounded-xl border text-sm bg-zinc-50 dark:bg-zinc-800">
                <option value="">Invite group member...</option>
                {groupMembers.map(p => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <button type="submit" className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm">Invite</button>
            </form>
          )}
          {isOwner && outing.publicToken && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <QrInvite token={outing.publicToken} type="outing" name={outing.name} />
            </div>
          )}
        </div>

        {/* Activities */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="font-semibold">Activities</h3>

          {activities.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl">
              <p className="text-sm text-zinc-500">No activities yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityStats.map(a => (
                <ActivityCard
                  key={a.id}
                  activity={a}
                  outingId={outingId}
                  groupId={groupId}
                  isOwner={isOwner}
                  participants={participants}
                  usersMap={usersMap}
                  userId={session.userId}
                />
              ))}
            </div>
          )}

          {/* Create activity form */}
          {isOwner && outing.status !== "SETTLED" && (
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <summary className="font-medium text-sm cursor-pointer">+ Add Activity</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createActivityAction } = await import("@/server/activities/actions");
                const res = await createActivityAction(formData);
                if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="outingId" value={outingId} />
                <input name="name" placeholder="Pool / Restaurant / InDrive" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <select name="pricingModel" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
                  <option value="FIXED">FIXED — per-unit pricing</option>
                  <option value="VARIABLE">VARIABLE — custom items</option>
                </select>
                <input name="notes" placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Create Activity</button>
              </form>
            </details>
          )}
        </div>

        {/* Settlement */}
        {hasSettlement && (
          <Link href={`/groups/${groupId}/outings/${outingId}/settlement`} className="block w-full py-3 rounded-2xl bg-amber-500 text-white text-center font-medium">
            View Settlement Details
          </Link>
        )}
      </main>
    </div>
  );
}

function ActivityCard({ activity, outingId, groupId, isOwner, participants, usersMap, userId }: {
  activity: any;
  outingId: string;
  groupId: string;
  isOwner: boolean;
  participants: any[];
  usersMap: Map<string, string>;
  userId: string;
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
              <form action={async () => {
                "use server";
                const { closeActivityAction } = await import("@/server/activities/actions");
                await closeActivityAction(activity.id);
              }}>
                <button className="text-xs text-amber-600 hover:underline px-2 py-1 rounded border">Close</button>
              </form>
              <form action={async () => {
                "use server";
                const { deleteActivityAction } = await import("@/server/activities/actions");
                await deleteActivityAction(activity.id);
              }}>
                <button className="text-xs text-red-600 hover:underline px-2 py-1 rounded border">Delete</button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* FIXED ACTIVITY UI */}
      {isFixed && (
        <div className="space-y-3">
          {/* Products */}
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
                        <form action={async (formData: FormData) => {
                          "use server";
                          const { updateActivityProductAction } = await import("@/server/products/actions");
                          const res = await updateActivityProductAction(p.id, {
                            name: formData.get("name") as string || undefined,
                            unit: formData.get("unit") as string || undefined,
                            pricePerUnitDH: formData.get("pricePerUnitDH") as string || undefined,
                          });
                          if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                        }} className="absolute z-10 mt-1 p-2 rounded bg-white dark:bg-zinc-800 border shadow-lg space-y-1">
                          <input name="name" defaultValue={p.name} placeholder="Name" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="unit" defaultValue={p.unit} placeholder="Unit" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="pricePerUnitDH" defaultValue={(p.pricePerUnitCt / 100).toFixed(2)} placeholder="Price (DH)" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <button className="px-2 py-0.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Save</button>
                        </form>
                      </details>
                      <form action={async () => {
                        "use server";
                        const { deleteActivityProductAction } = await import("@/server/products/actions");
                        await deleteActivityProductAction(p.id);
                      }} className="ml-1 inline">
                        <button className="text-red-500 hover:underline">✕</button>
                      </form>
                    </>
                  )}
                </span>
              ))}
            </div>
            {canEdit && (
              <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2">
                <summary className="text-xs cursor-pointer text-zinc-500">+ Add Product</summary>
                <form action={async (formData: FormData) => {
                  "use server";
                  const { createActivityProductAction } = await import("@/server/products/actions");
                  const res = await createActivityProductAction(formData);
                  if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                }} className="space-y-2 mt-2">
                  <input type="hidden" name="activityId" value={activity.id} />
                  <input name="name" placeholder="Product name" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <input name="unit" placeholder="Unit (game, hour, etc.)" className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <input name="pricePerUnitDH" placeholder="Price per unit (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                  <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Product</button>
                </form>
              </details>
            )}
          </div>

          {/* Usage Records */}
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
                {/* Confirm/Dispute/Admin buttons */}
                {r.status !== "CONFIRMED" && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <form action={async () => {
                      "use server";
                      const { confirmUsageRecordAction } = await import("@/server/usage/actions");
                      await confirmUsageRecordAction(r.id);
                    }}>
                      <button className="text-xs text-green-600 hover:underline px-2 py-0.5 rounded border">Confirm</button>
                    </form>
                    <form action={async (formData: FormData) => {
                      "use server";
                      const { disputeUsageRecordAction } = await import("@/server/usage/actions");
                      const notes = formData.get("notes") as string;
                      await disputeUsageRecordAction(r.id, notes);
                    }}>
                      <button className="text-xs text-red-600 hover:underline px-2 py-0.5 rounded border">Dispute</button>
                    </form>
                    {isOwner && (
                      <>
                        {r.participants.filter((pp: any) => {
                          const conf = r.confirmations.find((c: any) => c.userId === pp.userId);
                          return conf && conf.status === "PENDING";
                        }).map((pp: any) => (
                          <form key={pp.userId} action={async () => {
                            "use server";
                            const { adminConfirmUsageRecordAction } = await import("@/server/usage/actions");
                            await adminConfirmUsageRecordAction(r.id, pp.userId);
                          }}>
                            <button className="text-xs text-blue-600 hover:underline px-2 py-0.5 rounded border" title={`Confirm on behalf of ${usersMap.get(pp.userId) || pp.userId}`}>
                              ✓ {usersMap.get(pp.userId) || pp.userId}
                            </button>
                          </form>
                        ))}
                      </>
                    )}
                  </div>
                )}
                {/* Edit/Delete usage record (admin only, OPEN or CLOSED-but-not-settled) */}
                {canEdit && (
                  <div className="flex gap-2 mt-1">
                    <details className="inline">
                      <summary className="inline cursor-pointer text-blue-500 hover:underline text-xs">Edit</summary>
                      <form action={async (formData: FormData) => {
                        "use server";
                        const { updateUsageRecordAction } = await import("@/server/usage/actions");
                        const qty = parseInt(formData.get("quantity") as string, 10);
                        const res = await updateUsageRecordAction(r.id, { quantity: qty });
                        if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                      }} className="inline-flex gap-1 items-center ml-1">
                        <input name="quantity" type="number" min="1" defaultValue={r.quantity} className="w-16 px-1 py-0.5 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                        <button className="text-xs text-blue-600 hover:underline">Save</button>
                      </form>
                    </details>
                    <form action={async () => {
                      "use server";
                      const { deleteUsageRecordAction } = await import("@/server/usage/actions");
                      await deleteUsageRecordAction(r.id);
                    }}>
                      <button className="text-xs text-red-500 hover:underline">Delete</button>
                    </form>
                  </div>
                )}
              </div>
            ))}
            {/* Record usage form */}
            {canEdit && (
              <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
                <summary className="text-xs cursor-pointer text-zinc-500">+ Record Usage</summary>
                <form action={async (formData: FormData) => {
                  "use server";
                  const { createUsageRecordAction } = await import("@/server/usage/actions");
                  const res = await createUsageRecordAction(formData);
                  if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                }} className="space-y-2 mt-2">
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
                </form>
              </details>
            )}
          </div>
        </div>
      )}

      {/* VARIABLE ACTIVITY UI */}
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
                        <form action={async (formData: FormData) => {
                          "use server";
                          const { updateLineItemAction } = await import("@/server/lineitems/actions");
                          const res = await updateLineItemAction(l.id, {
                            description: formData.get("description") as string || undefined,
                            priceDH: formData.get("priceDH") as string || undefined,
                          });
                          if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                        }} className="absolute z-10 mt-1 p-2 rounded bg-white dark:bg-zinc-800 border shadow-lg space-y-1">
                          <input name="description" defaultValue={l.description} placeholder="Description" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <input name="priceDH" defaultValue={(l.priceCentimes / 100).toFixed(2)} placeholder="Price (DH)" className="w-full px-2 py-1 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                          <button className="px-2 py-0.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Save</button>
                        </form>
                      </details>
                      <form action={async () => {
                        "use server";
                        const { deleteLineItemAction } = await import("@/server/lineitems/actions");
                        await deleteLineItemAction(l.id);
                      }}>
                        <button className="text-red-500 hover:underline">✕</button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {activity.lineItems.length === 0 && (
            <div className="text-xs text-zinc-500 italic">No items yet</div>
          )}
          {/* Add item form (admin) */}
          {canEdit && (
            <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
              <summary className="text-xs cursor-pointer text-zinc-500">+ Add Item</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createLineItemAction } = await import("@/server/lineitems/actions");
                const res = await createLineItemAction(formData);
                if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
              }} className="space-y-2 mt-2">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" defaultValue={userId} className="hidden" />
                <input name="description" placeholder="What was consumed?" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <input name="priceDH" placeholder="Price (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Item</button>
              </form>
            </details>
          )}
          {/* Participant self-add for variable */}
          {!isOwner && activity.status === "OPEN" && (
            <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
              <summary className="text-xs cursor-pointer text-zinc-500">+ Add My Item</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createLineItemAction } = await import("@/server/lineitems/actions");
                const res = await createLineItemAction(formData);
                if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
              }} className="space-y-2 mt-2">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" value={userId} />
                <input name="description" placeholder="What did you consume?" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <input name="priceDH" placeholder="Price (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
                <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Add Item</button>
              </form>
            </details>
          )}
        </div>
      )}

      {/* Payments (all activities) */}
      <div>
        <div className="text-xs font-medium text-zinc-400 mb-1">Payments</div>
        {activity.payments.map((p: any) => (
          <div key={p.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900 mb-1 flex justify-between">
            <span>{usersMap.get(p.userId) || "?"}: {formatDH(p.amountCentimes)}</span>
            {canEdit && (
              <>
                <details className="inline">
                  <summary className="inline cursor-pointer text-blue-500 hover:underline">✏</summary>
                  <form action={async (formData: FormData) => {
                    "use server";
                    const { updateActivityPaymentAction } = await import("@/server/payments/actions");
                    const res = await updateActivityPaymentAction(p.id, formData.get("amountDH") as string);
                    if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
                  }} className="inline-flex gap-1 items-center ml-1">
                    <input name="amountDH" defaultValue={(p.amountCentimes / 100).toFixed(2)} placeholder="Amount (DH)" className="w-20 px-1 py-0.5 rounded border text-xs bg-zinc-50 dark:bg-zinc-700" />
                    <button className="text-xs text-blue-600 hover:underline">Save</button>
                  </form>
                </details>
                <form action={async () => {
                  "use server";
                  const { deleteActivityPaymentAction } = await import("@/server/payments/actions");
                  await deleteActivityPaymentAction(p.id);
                }}>
                  <button className="text-red-500 hover:underline">✕</button>
                </form>
              </>
            )}
          </div>
        ))}
        {canEdit && (
          <details className="rounded border border-zinc-200 dark:border-zinc-700 p-2 mt-1">
            <summary className="text-xs cursor-pointer text-zinc-500">+ Record Payment</summary>
            <form action={async (formData: FormData) => {
              "use server";
              const { recordActivityPaymentAction } = await import("@/server/payments/actions");
              const res = await recordActivityPaymentAction(formData);
              if (res?.error) redirect(`/groups/${groupId}/outings/${outingId}?error=${encodeURIComponent(res.error)}`);
            }} className="space-y-2 mt-2">
              <input type="hidden" name="activityId" value={activity.id} />
              <select name="userId" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800">
                <option value="">Who paid?</option>
                {participants.map((p: any) => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <input name="amountDH" placeholder="Amount (DH)" required className="w-full px-2 py-1 rounded border text-sm bg-zinc-50 dark:bg-zinc-800" />
              <button className="px-3 py-1 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs">Record Payment</button>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
