"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import { IconCheck, IconX, IconPencil, IconChevronRight, IconReceipt } from "@/components/icons";

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
      {hasError && <div className="mt-2 p-2.5 rounded-[12px] bg-danger-subtle border border-danger/20 text-danger text-[13px]">{state.error}</div>}
    </form>
  );
}

function SplitBar({ paid, responsibility }: { paid: number; responsibility: number }) {
  const t = useTranslations("outing");
  const max = Math.max(paid, responsibility, 1);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted w-20">{t("paid")}</span>
        <div className="progress-track flex-1">
          <div className="progress-fill" style={{ width: `${Math.round((paid / max) * 100)}%` }} />
        </div>
        <span className="money text-[12px] font-semibold w-20 text-end">{formatDH(paid)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-muted w-20">{t("owed")}</span>
        <div className="progress-track flex-1">
          <div className="progress-fill" style={{ width: `${Math.round((responsibility / max) * 100)}%`, background: "var(--muted)", opacity: 0.7 }} />
        </div>
        <span className="money text-[12px] font-semibold w-20 text-end">{formatDH(responsibility)}</span>
      </div>
    </div>
  );
}

export default function ClientOutingPage({
  groupId, outingId, isOwner, sessionUserId,
  participants, usersMap, activities, activityStats,
  memberBalances, totalResponsibility, totalPaid, allActivitiesClosed, hasSettlement, outing,
  groupName,
}: {
  groupId: string; outingId: string; isOwner: boolean; sessionUserId: string;
  participants: any[]; usersMap: Map<string, string>; activities: any[]; activityStats: any[]; memberBalances: any[];
  totalResponsibility: number; totalPaid: number; allActivitiesClosed: boolean;
  hasSettlement: boolean; outing: any;
  groupName?: string;
}) {
  const netDiff = totalResponsibility - totalPaid;
  const t = useTranslations("outing");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <div>
        <nav aria-label={tc("breadcrumb")} className="text-[13px] text-muted mb-1.5">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">{tn("groups")}</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/groups/${groupId}`} className="hover:text-foreground transition-colors">{groupName ?? tn("groups")}</Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground font-medium">{outing.name}</span>
        </nav>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-extrabold text-[26px] truncate tracking-tight">{outing.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isOwner && outing.status === "PLANNING" && (
              <WForm action={async () => await activateOutingAction(outingId)} initialState={{}}>
                <button className="btn-primary btn-sm">{t("activate")}</button>
              </WForm>
            )}
          {isOwner && allActivitiesClosed && outing.status !== "SETTLED" && !hasSettlement && (
            <WForm
              action={async () => {
                const { finalizeSettlementAction } = await import("@/server/settlement/actions");
                const res = await finalizeSettlementAction(outingId);
                if (res?.error) return res;
                redirect(`/groups/${groupId}/outings/${outingId}/settlement`);
              }}
              initialState={{}}
            >
              <button className="btn-navy btn-sm">{t("settleOuting")}</button>
            </WForm>
          )}
            {isOwner && outing.status === "SETTLED" && (
              <span className="tag bg-success-subtle text-success"><IconCheck size={12} />{t("settled")}</span>
            )}
          </div>
        </div>
        <p className="text-[13px] text-muted mt-1">{outing.status === "PLANNING" ? tc("planning") : outing.status === "ACTIVE" ? tc("activeTag") : outing.status === "SETTLED" ? tc("settledTag") : outing.status} · {t("headMeta", { p: participants.length, a: activities.length })}</p>
      </div>
        {/* Live balances — borderless band */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
            <div>
              <div className="text-[13px] text-muted mb-1">{t("liveBalances")}</div>
              <div className="money-hero text-[40px] font-extrabold">{formatDH(totalPaid)}</div>
              <div className="text-[13px] text-muted mt-1">{t("paidOf", { total: formatDH(totalResponsibility) })}</div>
            </div>
            <div className="sm:text-end">
              <div className="text-[13px] text-muted">{t("netDiff")}</div>
              <div className={`money text-[20px] font-bold ${netDiff > 0 ? "text-success" : netDiff < 0 ? "text-danger" : "text-muted"}`}>
                {netDiff > 0 ? "+" : ""}{formatDH(netDiff)}
              </div>
            </div>
          </div>
          <SplitBar paid={totalPaid} responsibility={totalResponsibility} />
          <div className="divider mt-6"></div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0 order-1">
        {/* Activities — timeline */}
        <section className="space-y-4">
          <h2 className="text-[18px] font-semibold tracking-tight">{t("activities")}</h2>
          {activities.length === 0 ? (
            <div className="card border-dashed p-10 text-center">
              <div className="w-12 h-12 mx-auto rounded-[20px] bg-elevated text-muted flex items-center justify-center mb-3"><IconReceipt size={22} /></div>
              <p className="text-[14px] text-muted">{t("noActivities")}</p>
            </div>
          ) : (
            <div className="timeline space-y-3">
              <div className="timeline-rail" aria-hidden="true"></div>
              {activityStats.map((a: any) => (
                <div key={a.id} className="flex gap-3">
                  <div className={`timeline-dot ${a.status === "CLOSED" ? "closed" : ""}`} aria-hidden="true">
                    <span className={`w-2 h-2 rounded-full ${a.status === "OPEN" ? "bg-brand" : "bg-muted"}`}></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <ActivityCard activity={a} outingId={outingId} groupId={groupId} isOwner={isOwner} participants={participants} usersMap={usersMap} userId={sessionUserId} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isOwner && outing.status !== "SETTLED" && (
            <div className="card-elevated p-5">
              <h3 className="text-[14px] font-semibold mb-3">{t("newActivity")}</h3>
              <WForm action={async (prevState, formData) => await createActivityAction(formData)} initialState={{}} className="space-y-3">
                <input type="hidden" name="outingId" value={outingId} />
                <input name="name" placeholder={t("activityNamePh")} required className="input" />
                <select name="pricingModel" className="input">
                  <option value="FIXED">{t("fixedOpt")}</option>
                  <option value="VARIABLE">{t("variableOpt")}</option>
                </select>
                <input name="notes" placeholder={t("notesPh")} className="input" />
                <button className="btn-primary w-full py-2.5">{t("createActivity")}</button>
              </WForm>
            </div>
          )}
        </section>
          </div>
          <aside className="space-y-8 lg:sticky lg:top-6 min-w-0 order-2">
            <section>
              <h2 className="section-label mb-1">{t("balances")}</h2>
              <div className="ledger">
                {memberBalances.filter((b: any) => b.netBalance !== 0).map((b: any) => (
                  <div key={b.userId} className="flex items-center justify-between py-1.5">
                    <span className="text-[14px]">{b.displayName}</span>
                    <span className={`money text-[15px] font-semibold ${b.netBalance > 0 ? "text-success" : "text-danger"}`}>
                      {b.netBalance > 0 ? "+" : ""}{formatDH(b.netBalance)}
                    </span>
                  </div>
                ))}
                {memberBalances.filter((b: any) => b.netBalance !== 0).length === 0 ? (
                  <div className="text-center py-3 text-[14px] text-muted">{t("settledUp")}</div>
                ) : (
                  memberBalances.filter((b: any) => b.netBalance === 0).length > 0 && (
                    <div className="text-[12px] text-muted pt-1">
                      {t("balancedN", { count: memberBalances.filter((b: any) => b.netBalance === 0).length })}
                    </div>
                  )
                )}
              </div>
            </section>
            <section>
              <h2 className="section-label mb-2">{t("participants")}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {participants.map((p: any) => (
                  <span key={p.id} className="tag bg-elevated text-foreground">
                    {p.user.displayName}
                    {p.role === "OWNER" && <span className="tag bg-brand-subtle text-brand ms-1">{tc("owner")}</span>}
                    {isOwner && p.userId !== sessionUserId && (
                      <WForm action={async () => await removeOutingParticipantAction(outingId, p.userId)} initialState={{}} className="inline ms-1">
                        <button type="submit" aria-label={t("removeParticipant", { name: p.user.displayName })} className="inline-flex items-center text-danger/60 hover:text-danger transition-colors ms-1"><IconX size={12} /></button>
                      </WForm>
                    )}
                  </span>
                ))}
              </div>
              {!isOwner && (
                <WForm action={async () => await requestLeaveOutingAction(outingId)} initialState={{}} className="mt-2">
                  <button type="submit" className="text-[12px] text-danger hover:underline">{t("leaveOuting")}</button>
                </WForm>
              )}
              {isOwner && outing.publicToken && (
                <div className="pt-3 mt-3 border-t border-border">
                  <QrInvite token={outing.publicToken} type="outing" name={outing.name} />
                </div>
              )}
            </section>
            {hasSettlement && (
              <a href={`/groups/${groupId}/outings/${outingId}/settlement`} className="btn-navy w-full py-3 text-[15px] text-center rounded-[20px]">{t("viewSettlement")}</a>
            )}
          </aside>
        </div>
      </main>
  );
}

function StatusTag({ status }: { status: string }) {
  const tc = useTranslations("common");
  if (status === "CONFIRMED") return (
    <span className="tag bg-success-subtle text-success"><span className="status-dot bg-success"></span>{tc("confirmedTag")}</span>
  );
  if (status === "DISPUTED") return (
    <span className="tag bg-danger-subtle text-danger"><span className="status-dot bg-danger"></span>{tc("disputedTag")}</span>
  );
  return (
    <span className="tag bg-warn-subtle text-warn"><span className="status-dot bg-warn"></span>{tc("pendingTag")}</span>
  );
}

function ActivityCard({ activity, outingId, groupId, isOwner, participants, usersMap, userId }: {
  activity: any; outingId: string; groupId: string; isOwner: boolean;
  participants: any[]; usersMap: Map<string, string>; userId: string;
}) {
  const t = useTranslations("outing");
  const tc = useTranslations("common");
  const isFixed = activity.pricingModel === "FIXED";
  const isVariable = activity.pricingModel === "VARIABLE";
  const canEdit = isOwner && activity.status === "OPEN";

  return (
    <div className="card-elevated p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold tracking-tight">{activity.name}</span>
            <span className="tag bg-elevated text-muted">{isFixed ? tc("fixed") : tc("variable")}</span>
            {activity.status === "OPEN" ? (
              <span className="tag bg-success-subtle text-success"><span className="status-dot bg-success"></span>{tc("open")}</span>
            ) : (
              <span className="tag bg-elevated text-muted"><span className="status-dot bg-muted"></span>{activity.status === "CLOSED" ? tc("closed") : activity.status}</span>
            )}
          </div>
          <div className="money text-[22px] font-bold mt-2">{formatDH(activity.responsibility)}</div>
          <div className="flex items-center gap-3 mt-1.5 text-[13px] text-muted flex-wrap">
            <span>{t("paid")} <span className="money font-semibold text-foreground">{formatDH(activity.paid)}</span></span>
            <span className={activity.balance !== 0 ? (activity.balance > 0 ? "text-success" : "text-danger") : ""}>
              {t("balance")} <span className="money font-semibold">{activity.balance > 0 ? "+" : ""}{formatDH(activity.balance)}</span>
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <WForm action={async () => await closeActivityAction(activity.id)} initialState={{}}>
              <button type="submit" className="btn-ghost text-warn">{tc("close")}</button>
            </WForm>
            <WForm action={async () => await deleteActivityAction(activity.id)} initialState={{}}>
              <button type="submit" className="btn-ghost text-danger">{tc("delete")}</button>
            </WForm>
          </div>
        )}
      </div>

      <SplitBar paid={activity.paid} responsibility={activity.responsibility} />

      {/* FIXED: Products + usage as expense objects */}
      {isFixed && (
        <div className="space-y-4">
          {activity.products.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-muted mb-2 uppercase tracking-wide">{t("products")}</div>
              <div className="space-y-1.5">
                {activity.products.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-[12px] bg-elevated">
                    <span className="text-[14px] min-w-0">{p.name} <span className="text-muted">· {formatDH(p.pricePerUnitCt)}/{p.unit}</span></span>
                    {canEdit && (
                      <div className="flex items-center gap-1.5 flex-shrink-0 ms-2">
                        <details className="relative">
                          <summary className="cursor-pointer text-brand text-[12px] font-semibold hover:underline">{tc("edit")}</summary>
                          <WForm action={async (prevState, formData) => {
                            return await updateActivityProductAction(p.id, {
                              name: formData.get("name") as string || undefined,
                              unit: formData.get("unit") as string || undefined,
                              pricePerUnitDH: formData.get("pricePerUnitDH") as string || undefined,
                            });
                          }} initialState={{}} className="absolute end-0 z-10 mt-1 p-3 rounded-[20px] bg-surface border border-border shadow-lg space-y-2 w-56">
                            <input name="name" defaultValue={p.name} placeholder={t("namePh")} className="input text-[13px]" />
                            <input name="unit" defaultValue={p.unit} placeholder={t("unitLabel")} className="input text-[13px]" />
                            <input name="pricePerUnitDH" defaultValue={(p.pricePerUnitCt / 100).toFixed(2)} placeholder={t("pricePh")} className="input text-[13px]" />
                            <button type="submit" className="btn-primary w-full py-2 text-[12px]">{tc("save")}</button>
                          </WForm>
                        </details>
                        <WForm action={async () => await deleteActivityProductAction(p.id)} initialState={{}} className="inline">
                          <button type="submit" aria-label={t("deleteItem", { name: p.name })} className="inline-flex items-center text-danger/60 hover:text-danger transition-colors"><IconX size={12} /></button>
                        </WForm>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {canEdit && (
            <details className="rounded-[20px] border border-border p-3.5">
              <summary className="flex items-center gap-1 text-[13px] cursor-pointer text-muted font-semibold"><IconChevronRight size={13} className="chev" /> {t("addProduct")}</summary>
              <WForm action={async (prevState, formData) => await createActivityProductAction(formData)} initialState={{}} className="space-y-2.5 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input name="name" placeholder={t("productNamePh")} required className="input text-[13px]" />
                <input name="unit" placeholder={t("unitPh")} className="input text-[13px]" />
                <input name="pricePerUnitDH" placeholder={t("pricePh")} required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">{t("addProductBtn")}</button>
              </WForm>
            </details>
          )}

          {/* Usage records as financial objects */}
          {activity.usageRecords.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-muted mb-2 uppercase tracking-wide">{t("usage")}</div>
              <div className="space-y-2">
                {activity.usageRecords.map((r: any) => {
                  const product = activity.products.find((p: any) => p.id === r.productId);
                  const n = r.participants.length || 1;
                  const each = Math.floor((r.totalCentimes ?? 0) / n);
                  const imIn = r.participants.some((pp: any) => pp.userId === userId);
                  const myShare = imIn ? each : 0;
                  return (
                    <div key={r.id} className="rounded-[12px] bg-elevated p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium">{r.quantity} × {product?.name || "?"}</div>
                          <div className="money text-[18px] font-bold mt-0.5">{formatDH(r.totalCentimes)}</div>
                        </div>
                        <StatusTag status={r.status} />
                      </div>
                      <div className="split-bar" aria-hidden="true">
                        {r.participants.map((pp: any) => (
                          <span key={pp.userId} style={{ width: `${100 / n}%`, background: pp.userId === userId ? "var(--brand)" : "var(--muted)", opacity: pp.userId === userId ? 1 : 0.45 }} />
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-[12px] bg-surface p-2">
                          <div className="text-[11px] text-muted">{t("each")}</div>
                          <div className="money text-[13px] font-bold">{formatDH(each)}</div>
                        </div>
                        <div className="rounded-[12px] bg-surface p-2">
                          <div className="text-[11px] text-muted">{t("yourShare")}</div>
                          <div className="money text-[13px] font-bold">{formatDH(myShare)}</div>
                        </div>
                        <div className="rounded-[12px] bg-surface p-2">
                          <div className="text-[11px] text-muted">{t("split")}</div>
                          <div className="text-[13px] font-bold">{t("splitN", { count: n })}</div>
                        </div>
                      </div>
                      <div className="text-[12px] text-muted">
                        {r.participants.map((pp: any) => usersMap.get(pp.userId) || pp.userId).join(" · ")}
                      </div>
                      {r.status !== "CONFIRMED" && (
                        <div className="flex gap-2 flex-wrap">
                          <WForm action={async () => await confirmUsageRecordAction(r.id)} initialState={{}}>
                            <button type="submit" className="btn-ghost text-success">{tc("confirm")}</button>
                          </WForm>
                          <WForm action={async (prevState, formData) => {
                            const notes = formData.get("notes") as string;
                            return await disputeUsageRecordAction(r.id, notes);
                          }} initialState={{}}>
                            <button type="submit" className="btn-ghost text-danger">{t("dispute")}</button>
                          </WForm>
                          {isOwner && r.participants.filter((pp: any) => {
                            const conf = r.confirmations.find((c: any) => c.userId === pp.userId);
                            return conf && conf.status === "PENDING";
                          }).map((pp: any) => (
                            <WForm key={pp.userId} action={async () => await adminConfirmUsageRecordAction(r.id, pp.userId)} initialState={{}}>
                            <button type="submit" className="btn-ghost text-brand" title={t("confirmOnBehalf", { name: usersMap.get(pp.userId) || pp.userId })}>
                              <IconCheck size={13} />{usersMap.get(pp.userId) || pp.userId}
                            </button>
                            </WForm>
                          ))}
                        </div>
                      )}
                      {canEdit && (
                        <div className="flex gap-2 items-center pt-1">
                          <details className="relative">
                            <summary className="cursor-pointer text-brand text-[12px] font-semibold hover:underline">{tc("edit")}</summary>
                            <WForm action={async (prevState, formData) => {
                              const qty = parseInt(formData.get("quantity") as string, 10);
                              return await updateUsageRecordAction(r.id, { quantity: qty });
                            }} initialState={{}} className="absolute start-0 z-10 mt-1 p-3 rounded-[20px] bg-surface border border-border shadow-lg flex gap-2 items-center">
                              <input name="quantity" type="number" min="1" defaultValue={r.quantity} className="input text-[13px] w-20" />
                              <button type="submit" className="btn-primary py-2 px-3 text-[12px]">{tc("save")}</button>
                            </WForm>
                          </details>
                          <WForm action={async () => await deleteUsageRecordAction(r.id)} initialState={{}}>
                            <button type="submit" className="text-[12px] text-danger hover:underline">{tc("delete")}</button>
                          </WForm>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {canEdit && (
            <details className="rounded-[20px] border border-border p-3.5">
              <summary className="flex items-center gap-1 text-[13px] cursor-pointer text-muted font-semibold"><IconChevronRight size={13} className="chev" /> {t("recordUsage")}</summary>
              <WForm action={async (prevState, formData) => await createUsageRecordAction(formData)} initialState={{}} className="space-y-2.5 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <select name="productId" required className="input text-[13px]">
                  <option value="">{t("selectProduct")}</option>
                  {activity.products.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({formatDH(p.pricePerUnitCt)}/{p.unit})</option>)}
                </select>
                <input name="quantity" type="number" min="1" placeholder={t("quantity")} required className="input text-[13px]" />
                <div className="text-[12px] font-medium text-muted">{t("selectParticipants")}</div>
                <div className="space-y-1">
                  {participants.map((p: any) => (
                    <label key={p.userId} className="flex items-center gap-2 text-[13px] py-1 cursor-pointer">
                      <input type="checkbox" name="participantIds" value={p.userId} className="accent-action" />
                      {p.user.displayName}
                    </label>
                  ))}
                </div>
                <button className="btn-primary w-full py-2 text-[13px]">{t("recordUsageBtn")}</button>
              </WForm>
            </details>
          )}
        </div>
      )}

      {/* VARIABLE: line items as expense objects */}
      {isVariable && (
        <div className="space-y-3">
          {activity.lineItems.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-muted mb-2 uppercase tracking-wide">{t("items")}</div>
              <div className="space-y-2">
                {activity.lineItems.map((l: any) => {
                  const canEditItem = l.userId === userId || isOwner;
                  const isMine = l.userId === userId;
                  return (
                    <div key={l.id} className="rounded-[12px] bg-elevated p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium">{l.description}</div>
                          <div className="text-[12px] text-muted">{t("paidBy")} {usersMap.get(l.userId) || "?"}{isMine ? ` ${t("youSuffix")}` : ""}</div>
                        </div>
                        <div className="money text-[18px] font-bold flex-shrink-0">{formatDH(l.priceCentimes)}</div>
                      </div>
                      {canEditItem && canEdit && (
                        <div className="flex items-center gap-1.5">
                          <details className="relative">
                            <summary className="cursor-pointer text-brand text-[12px] font-semibold hover:underline">{tc("edit")}</summary>
                            <WForm action={async (prevState, formData) => {
                              return await updateLineItemAction(l.id, {
                                description: formData.get("description") as string || undefined,
                                priceDH: formData.get("priceDH") as string || undefined,
                              });
                            }} initialState={{}} className="absolute end-0 z-10 mt-1 p-3 rounded-[20px] bg-surface border border-border shadow-lg space-y-2 w-56">
                          <input name="description" defaultValue={l.description} placeholder={t("descPh")} className="input text-[13px]" />
                          <input name="priceDH" defaultValue={(l.priceCentimes / 100).toFixed(2)} placeholder={t("priceItemPh")} className="input text-[13px]" />
                              <button type="submit" className="btn-primary w-full py-2 text-[12px]">{tc("save")}</button>
                            </WForm>
                          </details>
                          <WForm action={async () => await deleteLineItemAction(l.id)} initialState={{}}>
                            <button type="submit" aria-label={t("deleteItem", { name: l.description })} className="inline-flex items-center text-danger/60 hover:text-danger transition-colors"><IconX size={12} /></button>
                          </WForm>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activity.lineItems.length === 0 && <div className="text-[13px] text-muted italic">{t("noItems")}</div>}
          {canEdit && (
            <details className="rounded-[20px] border border-border p-3.5">
              <summary className="flex items-center gap-1 text-[13px] cursor-pointer text-muted font-semibold"><IconChevronRight size={13} className="chev" /> {t("addItem")}</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2.5 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" defaultValue={userId} className="hidden" />
                <input name="description" placeholder={t("descPh")} required className="input text-[13px]" />
                <input name="priceDH" placeholder={t("priceItemPh")} required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">{t("addItemBtn")}</button>
              </WForm>
            </details>
          )}
          {!isOwner && activity.status === "OPEN" && (
            <details className="rounded-[20px] border border-border p-3.5">
              <summary className="flex items-center gap-1 text-[13px] cursor-pointer text-muted font-semibold"><IconChevronRight size={13} className="chev" /> {t("addMyItem")}</summary>
              <WForm action={async (prevState, formData) => await createLineItemAction(formData)} initialState={{}} className="space-y-2.5 mt-3">
                <input type="hidden" name="activityId" value={activity.id} />
                <input type="hidden" name="userId" value={userId} className="hidden" />
                <input name="description" placeholder={t("descMinePh")} required className="input text-[13px]" />
                <input name="priceDH" placeholder={t("priceItemPh")} required className="input text-[13px]" />
                <button className="btn-primary w-full py-2 text-[13px]">{t("addItemBtn")}</button>
              </WForm>
            </details>
          )}
        </div>
      )}

      {/* Payments */}
      <div className="space-y-2">
        <div className="text-[12px] font-semibold text-muted uppercase tracking-wide">{t("payments")}</div>
        {activity.payments.length > 0 && (
          <div className="space-y-1.5">
            {activity.payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-[12px] bg-elevated">
                <span className="text-[14px]">{usersMap.get(p.userId) || "?"}{p.userId === userId ? ` ${t("youSuffix")}` : ""}</span>
                <span className="flex items-center gap-2">
                  <span className="money text-[15px] font-semibold">{formatDH(p.amountCentimes)}</span>
                  {canEdit && (
                    <span className="flex items-center gap-1">
                      <details className="relative">
                        <summary className="cursor-pointer text-brand text-[12px] font-semibold hover:underline">{tc("edit")}</summary>
                        <WForm action={async (prevState, formData) => {
                          return await updateActivityPaymentAction(p.id, formData.get("amountDH") as string);
                        }} initialState={{}} className="absolute end-0 z-10 mt-1 p-3 rounded-[20px] bg-surface border border-border shadow-lg flex gap-2 items-center">
                          <input name="amountDH" defaultValue={(p.amountCentimes / 100).toFixed(2)} placeholder={t("amountPh")} className="input text-[13px] w-24" />
                          <button type="submit" className="btn-primary py-2 px-3 text-[12px]">{tc("save")}</button>
                        </WForm>
                      </details>
                <WForm action={async () => await deleteActivityPaymentAction(p.id)} initialState={{}}>
                  <button type="submit" aria-label={t("deletePayment")} className="inline-flex items-center text-danger/60 hover:text-danger transition-colors"><IconX size={12} /></button>
                </WForm>
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <details className="rounded-[20px] border border-border p-3.5">
            <summary className="flex items-center gap-1 text-[13px] cursor-pointer text-muted font-semibold"><IconChevronRight size={13} className="chev" /> {t("recordPayment")}</summary>
            <WForm action={async (prevState, formData) => await recordActivityPaymentAction(formData)} initialState={{}} className="space-y-2.5 mt-3">
              <input type="hidden" name="activityId" value={activity.id} />
              <select name="userId" required className="input text-[13px]">
                <option value="">{t("whoPaid")}</option>
                {participants.map((p: any) => <option key={p.userId} value={p.userId}>{p.user.displayName}</option>)}
              </select>
              <input name="amountDH" placeholder={t("amountPh")} required className="input text-[13px]" />
              <button className="btn-primary w-full py-2 text-[13px]">{t("recordPaymentBtn")}</button>
            </WForm>
          </details>
        )}
      </div>
    </div>
  );
}
