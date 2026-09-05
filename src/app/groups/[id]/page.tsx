import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) notFound();

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: session.userId } } });
  if (!member) return <div className="p-10 text-center">You are not a member of this group. Ask owner to invite you with your public ID.</div>;

  const isOwner = group.ownerId === session.userId;

  const members = await prisma.groupMember.findMany({ where: { groupId: id }, include: { user: true } });
  const activities = await prisma.activity.findMany({ where: { groupId: id }, include: { members: { include: { user: true } }, expenses: true }, orderBy: { createdAt: "desc" } });
  const expenses = await prisma.expense.findMany({ where: { groupId: id }, include: { allocations: { include: { user: true } }, payments: { include: { user: true } }, activity: true }, orderBy: { createdAt: "desc" } });
  const invitations = await prisma.groupInvitation.findMany({ where: { groupId: id, status: "PENDING" } });
  const events = await prisma.activityEvent.findMany({ where: { groupId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: true } });
  const settlement = await prisma.settlement.findUnique({ where: { groupId: id }, include: { transfers: true } });

  // Calculate stats
  const totalSpent = expenses.reduce((s, e) => s + e.totalCentimes, 0);
  const totalContributions = members.reduce((s, m) => s + m.contribution, 0);

  // For each member, calculate responsibility and paid
  const memberStats = members.map(m => {
    const responsibility = expenses.flatMap(e => e.allocations).filter(a => a.userId === m.userId).reduce((s, a) => s + a.amountCentimes, 0);
    const paid = expenses.flatMap(e => e.payments).filter(p => p.userId === m.userId).reduce((s, p) => s + p.amountCentimes, 0);
    const balance = paid - responsibility;
    return { member: m, responsibility, paid, balance };
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div className="flex-1">
            <h1 className="font-semibold">🎱 {group.name}</h1>
            <p className="text-xs text-zinc-500">{group.status} • {members.length} members • {activities.length} activities • {formatDH(totalSpent)} spent</p>
          </div>
          <Link href={`/groups/${id}/checkout`} className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Checkout</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Dashboard cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
            <div className="text-lg font-bold">{formatDH(totalSpent)}</div>
            <div className="text-xs text-zinc-500">Total spent</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
            <div className="text-lg font-bold">{activities.length}</div>
            <div className="text-xs text-zinc-500">Activities</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
            <div className="text-lg font-bold">{members.length}</div>
            <div className="text-xs text-zinc-500">Members</div>
          </div>
        </div>

        {/* Members + contributions */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="font-semibold">Members & Contributions</h3>
          <div className="space-y-3">
            {memberStats.map(({ member, responsibility, paid, balance }) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-sm font-bold">{member.user.displayName[0]}</div>
                  <div>
                    <div className="font-medium text-sm flex items-center gap-1">{member.user.displayName} {member.role === "OWNER" && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">owner</span>} <span className="font-mono text-xs text-zinc-500">{member.user.publicId}</span></div>
                    <div className="text-xs text-zinc-500">Contrib: {formatDH(member.contribution)} • Paid: {formatDH(paid)} • Resp: {formatDH(responsibility)} • {balance >= 0 ? `+${formatDH(balance)} receives` : `${formatDH(balance)} owes`}</div>
                  </div>
                </div>
                {isOwner && group.status !== "SETTLED" && group.status !== "CHECKOUT" && member.userId !== group.ownerId && (
                  <form action={async () => {
                    "use server";
                    const { removeMemberAction } = await import("@/server/groups/actions");
                    await removeMemberAction(id, member.userId);
                  }}>
                    <button className="text-xs text-red-600 hover:underline">Remove</button>
                  </form>
                )}
              </div>
            ))}
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-zinc-200 dark:border-zinc-700">
              <span>Total contributions: {formatDH(totalContributions)}</span>
              <span>Remaining: {formatDH(totalContributions - totalSpent)}</span>
            </div>
          </div>

          {isOwner && (group.status === "PLANNING" || group.status === "ACTIVE") && (
            <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h4 className="font-medium text-sm">Invite Member</h4>
              <form action={async (formData: FormData) => {
                "use server";
                const { inviteMemberAction } = await import("@/server/groups/actions");
                const res = await inviteMemberAction(formData);
                if (res?.error) throw new Error(res.error);
              }} className="flex gap-2">
                <input type="hidden" name="groupId" value={id} />
                <input name="publicId" placeholder="usr_XXXXXX" required className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <input name="suggestedContribution" type="number" min="0" step="0.5" placeholder="Suggested DH (e.g. 100)" defaultValue="100" title="Suggested contribution in DH" className="w-28 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Invite</button>
              </form>
              {invitations.length > 0 && (
                <div className="text-xs text-zinc-500">Pending invites: {invitations.map(i => i.inviteePublicId).join(", ")}</div>
              )}

              {/* Quick contribution edit for self */}
              <form action={async (formData: FormData) => {
                "use server";
                const { updateContributionAction } = await import("@/server/groups/actions");
                const res = await updateContributionAction(id, (formData.get("amount") as string) || "0");
                if (res?.error) throw new Error(res.error);
              }} className="flex gap-2 items-center">
                <span className="text-sm">My contribution (DH):</span>
                <input name="amount" type="number" min="0" step="0.5" defaultValue={(member.contribution / 100).toString()} className="w-24 px-2 py-1 rounded-lg border text-sm" />
                <button className="px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm">Save</button>
              </form>
            </div>
          )}
        </div>

        {/* Owner actions: start group / checkout */}
        {isOwner && group.status === "PLANNING" && (
          <form action={async () => {
            "use server";
            const { requireSession } = await import("@/server/auth/session");
            const { prisma } = await import("@/lib/prisma");
            const session = await requireSession();
            const g = await prisma.group.findUnique({ where: { id } });
            if (!g || g.ownerId !== session.userId) throw new Error("Only owner");
            if (g.status !== "PLANNING") throw new Error("Group already started");
            await prisma.group.update({ where: { id }, data: { status: "ACTIVE" } });
          }}>
            <button className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-medium">Start Group (Active)</button>
          </form>
        )}
        {isOwner && group.status === "ACTIVE" && (
          <form action={async () => {
            "use server";
            const { startCheckoutAction } = await import("@/server/groups/actions");
            await startCheckoutAction(id);
          }}>
            <button className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium">Start Checkout → Calculate Settlement</button>
          </form>
        )}
        {settlement && (
          <Link href={`/groups/${id}/checkout`} className="block w-full py-3 rounded-2xl bg-amber-500 text-white text-center font-medium">View Settlement • {settlement.transfers.length} transfers</Link>
        )}

        {/* Activities */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Activities</h3>
            <span className="text-xs text-zinc-500">{activities.length} total</span>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl">
              <p className="text-sm text-zinc-500">Nothing recorded yet.</p>
              <p className="text-xs text-zinc-400">Add the first table or expense.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex justify-between">
                  <div>
                    <div className="font-medium text-sm">🎱 {a.name} {a.type && <span className="text-xs text-zinc-500">• {a.type}</span>}</div>
                    <div className="text-xs text-zinc-500">{a.members.map(m => m.user.displayName).join(" • ")} • {a.expenses.reduce((s, e) => s + e.totalCentimes, 0) / 100} DH</div>
                    {a.startTime && <div className="text-xs text-zinc-400">{new Date(a.startTime).toLocaleTimeString()} - {a.endTime ? new Date(a.endTime).toLocaleTimeString() : ""} {a.rate && `@ ${a.rate / 100} DH/h`}</div>}
                  </div>
                  {isOwner && (
                    <form action={async () => {
                      "use server";
                      const { deleteActivityAction } = await import("@/server/activities/actions");
                      await deleteActivityAction(a.id);
                    }}>
                      <button className="text-xs text-red-500">Delete</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && (group.status === "PLANNING" || group.status === "ACTIVE") && (
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <summary className="font-medium text-sm cursor-pointer">+ Add Activity / Table</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createActivityAction } = await import("@/server/activities/actions");
                await createActivityAction(formData);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="groupId" value={id} />
                <input name="name" placeholder="Table 1" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="startTime" type="time" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <input name="endTime" type="time" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <input name="rateDH" type="number" min="0" step="0.5" placeholder="Rate DH/h (e.g. 60)" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <input name="type" placeholder="Type: TABLE/DRINKS" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Participants</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => (
                      <label key={m.userId} className="flex items-center gap-1 px-3 py-1 rounded-full border bg-white dark:bg-zinc-900 text-sm cursor-pointer">
                        <input type="checkbox" value={m.userId} className="participant" />
                        {m.user.displayName}
                      </label>
                    ))}
                  </div>
                  <input type="hidden" name="participantIds" id={`participants-${id}`} />
                  <script dangerouslySetInnerHTML={{
                    __html: `document.addEventListener('change', (e)=>{
                      if(e.target.classList.contains('participant')){
                        const checks=[...document.querySelectorAll('.participant:checked')].map(c=>c.value);
                        document.getElementById('participants-${id}').value=JSON.stringify(checks);
                      }
                    })`
                  }} />
                </div>
                <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Save Activity</button>
                <p className="text-xs text-zinc-500">Will be enhanced with proper client component later; for now select participants then save.</p>
              </form>
            </details>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="font-semibold">Expenses</h3>
          {expenses.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl text-sm text-zinc-500">No expenses recorded.</div>
          ) : (
            <div className="space-y-3">
              {expenses.map(e => (
                <div key={e.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                  <div className="flex justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{e.description} {e.activity && <span className="text-xs text-zinc-500">• {e.activity.name}</span>}</div>
                      <div className="text-xs text-zinc-500">Total: {formatDH(e.totalCentimes)} • Split: {e.allocationMode}</div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                        <span className="font-medium text-amber-700 dark:text-amber-300">Responsible:</span> {e.allocations.map(a => `${a.user.displayName} ${formatDH(a.amountCentimes)}`).join(" • ")}
                      </div>
                      <div className="text-xs mt-1">
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">Actually paid:</span>{" "}
                        {e.payments.length === 0 ? (
                          <span className="italic text-zinc-500">— Not recorded (unknown payer, settlement incomplete)</span>
                        ) : (
                          e.payments.map(p => `${p.user.displayName} ${formatDH(p.amountCentimes)}`).join(" • ")
                        )}
                      </div>
                      {e.payments.length === 0 && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Payer not specified — Hesab cannot determine who should be reimbursed for this expense.</div>}
                    </div>
                    {isOwner && group.status !== "SETTLED" && (
                      <form action={async () => {
                        "use server";
                        const { deleteExpenseAction } = await import("@/server/expenses/actions");
                        await deleteExpenseAction(e.id);
                      }}>
                        <button className="text-xs text-red-500">Delete</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOwner && (group.status === "PLANNING" || group.status === "ACTIVE") && (
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <summary className="font-medium text-sm cursor-pointer">+ Add Expense</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createExpenseAction } = await import("@/server/expenses/actions");
                const res = await createExpenseAction(formData);
                if (res?.error) throw new Error(res.error);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="groupId" value={id} />
                <input name="description" placeholder="Pool Table / Pizza / Drinks" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="quantity" type="number" min="1" step="1" defaultValue="1" placeholder="Qty" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <input name="unitPriceDH" type="number" min="0" step="0.01" placeholder="Unit price DH (e.g. 60)" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <input name="totalDH" type="number" min="0.01" step="0.01" placeholder="Total DH (e.g. 120)" required className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                  <select name="allocationMode" defaultValue="EQUAL" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
                    <option value="EQUAL">Equal</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="CUSTOM_AMOUNT">Custom</option>
                  </select>
                  <select name="activityId" defaultValue="" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
                    <option value="">No activity (or select)</option>
                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {/* RESPONSIBILITY - who owes */}
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">RESPONSIBILITY — Who should bear the cost?</p>
                  <p className="text-xs text-zinc-500 mb-2">Select participants and how to split. This is who OWES the expense.</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => (
                      <label key={m.userId} className="text-xs flex items-center gap-1 px-2 py-1 rounded-full border bg-white dark:bg-zinc-900 cursor-pointer"><input type="checkbox" className="exp-participant" value={m.userId} />{m.user.displayName}</label>
                    ))}
                  </div>
                  <input type="hidden" name="participantIds" id="exp-participants" defaultValue="[]" />
                  <div className="text-xs text-zinc-500 mt-2">Split will follow allocationMode (Equal / Percentage / Custom). For Percentage add JSON below.</div>
                </div>

                {/* PAYMENTS - who actually paid (OPTIONAL) */}
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 p-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">PAYMENT — Who actually paid? (Optional)</p>
                  <p className="text-xs text-zinc-500 mb-2">Multiple payers allowed. Leave empty if payer unknown — distinct from 0 DH. Example: Naoufal paid 90 DH for others.</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => (
                      <label key={m.userId} className="text-xs flex items-center gap-1 px-2 py-1 rounded-full border bg-white dark:bg-zinc-900 cursor-pointer"><input type="checkbox" className="exp-payer" value={m.userId} />{m.user.displayName}</label>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    <input type="hidden" name="payerIds" id="exp-payerIds" defaultValue="[]" />
                    <input name="payerAmountsDH" id="exp-payerAmounts" placeholder='Leave empty for unknown payer, or e.g. [120] or [80,40] in DH' className="px-3 py-2 rounded-xl border bg-white dark:bg-zinc-800 text-sm" />
                  </div>
                  <div className="text-xs text-zinc-500 mt-2">If you specify payers, amounts must sum to Total. Supports: one payer (120 DH), multiple payers (80+40), or empty.</div>
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3">
                  <p className="text-xs font-medium">Advanced — Percentage / Custom split (basis points: 10000 = 100%)</p>
                  <input name="percentages" placeholder='For PERCENTAGE mode: e.g. [3333,3333,3334] (must sum to 10000)' className="mt-1 w-full px-3 py-1 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-xs" />
                  <input name="customAmountsDH" placeholder='For CUSTOM mode: e.g. [80,40] in DH (must sum to Total)' className="mt-1 w-full px-3 py-1 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-xs" />
                  <input name="portions" placeholder='For PORTIONS mode: e.g. [2,1,1]' className="mt-1 w-full px-3 py-1 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-xs" />
                </div>

                <script dangerouslySetInnerHTML={{
                  __html: `
                  // DH <-> centimes helpers (integer math only, no float): "120.50" <-> 12050
                  function dhToC(s){
                    s=String(s==null?"":s).trim().replace(/\\s*(DH|dh|MAD|mad)\\s*$/,"").replace(/\\s+/g,"").replace(",",".");
                    var m=/^(\\d+)(?:\\.(\\d{1,2}))?$/.exec(s);
                    if(!m) return null;
                    return parseInt(m[1],10)*100+parseInt((m[2]||"")+"00".slice((m[2]||"").length),10);
                  }
                  function cToDH(c){ return (c%100===0)? String(c/100) : (c/100).toFixed(2); }
                  document.addEventListener('change', (e)=>{
                    if(e.target.classList.contains('exp-participant')){
                      const v=[...document.querySelectorAll('.exp-participant:checked')].map(c=>c.value);
                      const el=document.getElementById('exp-participants'); if(el) el.value=JSON.stringify(v);
                    }
                    if(e.target.classList.contains('exp-payer')){
                      const v=[...document.querySelectorAll('.exp-payer:checked')].map(c=>c.value);
                      const el=document.getElementById('exp-payerIds'); if(el) el.value=JSON.stringify(v);
                      const amtEl=document.getElementById('exp-payerAmounts');
                      const totalEl=document.querySelector('input[name="totalDH"]');
                      if(v.length===0){
                        if(amtEl) amtEl.value="";
                      } else if(totalEl && totalEl.value){
                        const total=dhToC(totalEl.value);
                        if(total==null) return;
                        if(v.length===1){
                          if(amtEl) amtEl.value=JSON.stringify([cToDH(total)]);
                        } else {
                          const base=Math.floor(total/v.length);
                          const rem=total%v.length;
                          const arr=Array(v.length).fill(base).map((x,i)=> cToDH(i<rem?x+1:x));
                          if(amtEl) amtEl.value=JSON.stringify(arr);
                        }
                      }
                    }
                  });
                  document.querySelector('input[name="totalDH"]')?.addEventListener('input', (e)=>{
                    const v=[...document.querySelectorAll('.exp-payer:checked')].map(c=>c.value);
                    const amtEl=document.getElementById('exp-payerAmounts');
                    if(v.length===1 && amtEl){
                      const total=dhToC(e.target.value||'');
                      if(total!=null) amtEl.value=JSON.stringify([cToDH(total)]);
                    }
                  });
                  `
                }} />

                <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Save Expense</button>
              </form>
            </details>
          )}
        </div>

        {/* Audit */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h3 className="font-semibold mb-3">Activity Log</h3>
          <div className="space-y-2 text-xs">
            {events.map(ev => (
              <div key={ev.id} className="flex gap-2">
                <span className="text-zinc-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                <span className="font-medium">{ev.actor?.displayName || "System"}</span>
                <span>{ev.eventType}</span>
                <span className="text-zinc-500">{ev.metadata}</span>
              </div>
            ))}
            {events.length === 0 && <p className="text-zinc-500">No events yet</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
