import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";
import { IconCheck } from "@/components/icons";

export default async function PublicSettlementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const settlement = await prisma.settlement.findUnique({
    where: { publicToken: token },
  });
  if (!settlement) notFound();

  const transfers = await prisma.settlementTransfer.findMany({
    where: { settlementId: settlement.id },
  });

  const userIds = [...new Set([...transfers.map(t => t.fromUserId), ...transfers.map(t => t.toUserId)])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = new Map(users.map(u => [u.id, u.displayName]));

  const outing = settlement.outingId ? await prisma.outing.findUnique({ where: { id: settlement.outingId } }) : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md surface-20 p-6 space-y-6">
        <div className="text-center">
          <div className="brand-mark mx-auto mb-3">P</div>
          <h1 className="text-[22px] font-bold tracking-tight">Settlement</h1>
          {outing && <p className="text-[13px] text-muted mt-1">{outing.name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="well p-4 text-center">
            <div className="text-[12px] text-muted mb-1">Expenses</div>
            <div className="money text-[18px] font-bold">{formatDH(settlement.totalExpenses)}</div>
          </div>
          <div className="well p-4 text-center">
            <div className="text-[12px] text-muted mb-1">Paid</div>
            <div className="money text-[18px] font-bold">{formatDH(settlement.totalPaid)}</div>
          </div>
        </div>

        {transfers.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-[15px] font-semibold">Transfers</h3>
            {transfers.map(t => (
              <div key={t.id} className="flex justify-between items-center py-3 px-4 rounded-[20px] bg-brand-subtle">
                <span className="text-[14px]">{userMap.get(t.fromUserId) || "?"} <span className="text-navy">→</span> {userMap.get(t.toUserId) || "?"}</span>
                <span className="money font-bold text-navy">{formatDH(t.amountCentimes)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="w-10 h-10 mx-auto rounded-full bg-success-subtle text-success flex items-center justify-center mb-2"><IconCheck size={18} /></div>
            <div className="text-[14px] font-semibold text-success">Everyone is settled up!</div>
          </div>
        )}

        <div className="text-center text-[12px] text-muted pt-4 border-t border-border">
          Created with <Link href="/" className="text-brand hover:underline font-medium">PoolSplit</Link>
        </div>
      </div>
    </div>
  );
}
