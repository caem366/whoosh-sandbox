import { useEffect, useMemo, useState } from 'react'

import {
  createSandboxTransaction,
  createSandboxSession,
  getGroup,
  isWhooshApiError,
  processSettlement,
  type CreateSandboxTransactionRequest,
  type GroupDetail,
  type GroupMember,
  type GroupSettlement,
  type SandboxTransactionResponse,
  type SettlementSimulation,
} from '../api/whoosh'

const SANDBOX_GROUP_STORAGE_KEY = 'whoosh-sandbox-group-id'

function formatCents(amountCents: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amountCents / 100)
}

function parseDisplayAmount(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const totalCents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(totalCents) && totalCents > 0 ? totalCents : null
}

function getAccountBalance(member: GroupMember, type: string): number {
  return member.accounts.find((account) => account.type === type)?.balanceCents ?? 0
}

function makeIdempotencyKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function memberName(data: GroupDetail, memberId: string): string {
  return data.members.find((member) => member.memberId === memberId)?.displayName ?? 'Unknown member'
}

function statusClass(status: string): string {
  return `status-badge status-${status}`
}

function formatEventTime(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function GroupPage() {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [data, setData] = useState<GroupDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [merchant, setMerchant] = useState('Uber Eats')
  const [amount, setAmount] = useState('200.00')
  const [payerMemberId, setPayerMemberId] = useState('')
  const [participantMemberIds, setParticipantMemberIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestPayload, setRequestPayload] = useState<unknown>(null)
  const [responsePayload, setResponsePayload] = useState<unknown>(null)
  const [result, setResult] = useState<SandboxTransactionResponse | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<number | null>(null)

  async function createFreshSandbox() {
    const session = await createSandboxSession()
    localStorage.setItem(SANDBOX_GROUP_STORAGE_KEY, session.groupId)
    setGroupId(session.groupId)
    const group = await getGroup(session.groupId)
    setData(group)
    setPayerMemberId(group.members[0]?.memberId ?? '')
    setParticipantMemberIds(group.members.map((member) => member.memberId))
    setRequestPayload(null)
    setResponsePayload(null)
    setResult(null)
    setActionError(null)
    setActionStatus(null)
    setLoadError(null)
  }

  async function refreshGroup() {
    if (!groupId) return
    try {
      const group = await getGroup(groupId)
      setData(group)
      setLoadError(null)
      setPayerMemberId((current) => current || group.members[0]?.memberId || '')
      setParticipantMemberIds((current) => current.length > 0 ? current : group.members.map((member) => member.memberId))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load WHOOSH group')
    }
  }

  useEffect(() => {
    let cancelled = false

    const savedGroupId = localStorage.getItem(SANDBOX_GROUP_STORAGE_KEY)
    const load = savedGroupId ? getGroup(savedGroupId) : createSandboxSession().then(async (session) => {
      localStorage.setItem(SANDBOX_GROUP_STORAGE_KEY, session.groupId)
      setGroupId(session.groupId)
      return getGroup(session.groupId)
    })

    void load.then((group) => {
      if (cancelled) return
      setData(group)
      setGroupId(group.group.id)
      setPayerMemberId(group.members[0]?.memberId ?? '')
      setParticipantMemberIds(group.members.map((member) => member.memberId))
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load WHOOSH sandbox')
    })

    return () => { cancelled = true }
  }, [])

  const contributions = useMemo(() => {
    if (!data || !result) return []
    return result.allocations.map((allocation) => ({
      name: memberName(data, allocation.responsibleMemberId),
      amountCents: allocation.amountCents,
      isPayer: allocation.responsibleMemberId === result.transaction.payerMemberId,
    }))
  }, [data, result])

  const recoverableCents = result?.settlements.reduce((total, settlement) => total + settlement.amountCents, 0) ?? 0

  function toggleParticipant(memberId: string) {
    setParticipantMemberIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId])
  }

  async function simulateAuthorization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const totalCents = parseDisplayAmount(amount)

    if (!data || !totalCents || !payerMemberId || participantMemberIds.length === 0 || merchant.trim().length === 0) {
      setActionStatus(null)
      setActionError('Enter a valid merchant and amount, choose a payer, and select at least one participant.')
      return
    }

    const payload: CreateSandboxTransactionRequest = {
      groupId: data.group.id,
      payerMemberId,
      merchant: merchant.trim(),
      totalCents,
      splitMethod: 'equal',
      participantMemberIds,
    }

    setRequestPayload(payload)
    setResponsePayload(null)
    setResult(null)
    setActionError(null)
    setActionStatus(null)
    setIsSubmitting(true)

    try {
      const authorization = await createSandboxTransaction(payload, makeIdempotencyKey('sandbox-authorization'))
      setResult(authorization)
      setResponsePayload(authorization)
      setActionStatus(201)
      await refreshGroup()
    } catch (error) {
      const apiError = isWhooshApiError(error) ? error : null
      setActionStatus(apiError?.status ?? null)
      setActionError(error instanceof Error ? error.message : 'Authorization failed')
      setResponsePayload(apiError?.payload ?? { error: 'Authorization failed' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function resetForm() {
    if (!data) return
    setMerchant('Uber Eats')
    setAmount('200.00')
    setPayerMemberId(data.members[0]?.memberId ?? '')
    setParticipantMemberIds(data.members.map((member) => member.memberId))
    setRequestPayload(null)
    setResponsePayload(null)
    setResult(null)
    setActionError(null)
    setActionStatus(null)
  }

  async function runSettlement(settlement: GroupSettlement, simulation: SettlementSimulation) {
    setActionError(null)
    setRequestPayload({ settlementId: settlement.id, simulation })
    setResponsePayload(null)
    setActionStatus(null)

    try {
      const response = await processSettlement(settlement.id, simulation, makeIdempotencyKey('sandbox-settlement'))
      setResponsePayload(response)
      setActionStatus(200)
      await refreshGroup()
    } catch (error) {
      const apiError = isWhooshApiError(error) ? error : null
      setActionStatus(apiError?.status ?? null)
      setActionError(error instanceof Error ? error.message : 'Settlement processing failed')
      setResponsePayload(apiError?.payload ?? { error: 'Settlement processing failed' })
    }
  }

  if (loadError && !data) return <main className="page-state">Unable to load sandbox: {loadError}</main>
  if (!data) return <main className="page-state">Loading WHOOSH sandbox…</main>

  return (
    <main className="sandbox-page">
      <header className="sandbox-header">
        <div>
          <p className="eyebrow">WHOOSH / DEVELOPER SANDBOX</p>
          <h1>{data.group.name}</h1>
          <p className="muted">Simulated CAD only · no real payment rails</p>
        </div>
        <div className="header-actions">
          <button className="button button-ghost" type="button" onClick={() => void createFreshSandbox()}>Reset sandbox</button>
          <button className="button button-secondary" type="button" onClick={() => void refreshGroup()}>Refresh state</button>
        </div>
      </header>

      {loadError && <p className="notice notice-error">Could not refresh group: {loadError}</p>}

      <section className="sandbox-grid" aria-label="WHOOSH transaction sandbox">
        <form className="panel simulator-panel" onSubmit={simulateAuthorization}>
          <div className="panel-heading">
            <div><p className="eyebrow">TRANSACTION SIMULATOR</p><h2>Create a group purchase</h2></div>
            <span className="live-dot">Live API</span>
          </div>

          <label className="field-label">Merchant
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} maxLength={160} required />
          </label>
          <label className="field-label">Total amount <span>CAD</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="200.00" required />
          </label>
          <label className="field-label">Member who fronts the purchase
            <select value={payerMemberId} onChange={(event) => setPayerMemberId(event.target.value)}>
              {data.members.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName} · available {formatCents(member.walletBalanceCents, data.group.currency)}</option>)}
            </select>
          </label>

          <div className="split-box">
            <div className="split-heading">
              <div><span className="field-label">Split configuration</span><p>Equal split is the currently supported API method.</p></div>
              <span className="status-badge status-posted">equal</span>
            </div>
            <div className="participant-list">
              {data.members.map((member) => (
                <label className="participant" key={member.memberId}>
                  <input type="checkbox" checked={participantMemberIds.includes(member.memberId)} onChange={() => toggleParticipant(member.memberId)} />
                  <span>{member.displayName}</span><small>{formatCents(member.walletBalanceCents, data.group.currency)} available</small>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Authorizing…' : 'Simulate authorization'}</button>
            <button className="button button-ghost" type="button" onClick={resetForm} disabled={isSubmitting}>Reset form</button>
          </div>
        </form>

        <aside className="panel inspector-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">DEVELOPER / API INSPECTOR</p><h2>Authorization trace</h2></div>
            {actionStatus && <span className={actionStatus < 300 ? 'http-status http-success' : 'http-status http-error'}>{actionStatus}</span>}
          </div>
          <div className="endpoint-row"><span className="method">POST</span><code>/api/sandbox/transactions</code></div>
          {actionError && <div className="notice notice-error">{actionError}</div>}
          <div className="code-section"><span>Request JSON</span><pre>{requestPayload ? JSON.stringify(requestPayload, null, 2) : 'Submit a simulated purchase to inspect its request.'}</pre></div>
          <div className="code-section"><span>Response JSON</span><pre>{responsePayload ? JSON.stringify(responsePayload, null, 2) : 'The API response will appear here.'}</pre></div>

          {result && <div className="authorization-result">
            <div className="result-heading"><span className="status-badge status-posted">Authorized</span><strong>{formatCents(result.transaction.totalCents, data.group.currency)} at {result.transaction.merchant}</strong></div>
            <div className="contribution-list">{contributions.map((contribution) => <div key={contribution.name}><span>{contribution.name}{contribution.isPayer ? ' · fronted purchase' : ''}</span><strong>{formatCents(contribution.amountCents, data.group.currency)}</strong></div>)}</div>
            <p className="recoverable-line">{memberName(data, result.transaction.payerMemberId)} can recover <strong>{formatCents(recoverableCents, data.group.currency)}</strong> through {result.settlements.length} settlement{result.settlements.length === 1 ? '' : 's'}.</p>
          </div>}
        </aside>
      </section>

      <section className="live-state" aria-label="Live group state">
        <div className="section-heading"><div><p className="eyebrow">LIVE GROUP STATE</p><h2>Balances and settlement obligations</h2></div><p className="muted">Derived from posted ledger journals</p></div>
        <div className="member-grid">
          {data.members.map((member) => <article className="member-card" key={member.memberId}>
            <div className="member-card-top"><strong>{member.displayName}</strong><span>{member.status}</span></div>
            <div className="balance-amount">{formatCents(member.walletBalanceCents, data.group.currency)}</div><span className="metric-label">Available sandbox balance</span>
            <div className="member-metrics"><div><span>Owes</span><strong>{formatCents(getAccountBalance(member, 'member_payable'), data.group.currency)}</strong></div><div><span>Recoverable</span><strong>{formatCents(getAccountBalance(member, 'member_receivable'), data.group.currency)}</strong></div></div>
          </article>)}
        </div>

        <div className="settlement-section">
          <div className="section-heading compact"><h3>Settlement queue</h3><span>{data.settlements.length} recorded</span></div>
          {data.settlements.length === 0 ? <p className="empty-state">No settlement obligations yet. Simulate a shared purchase to create them.</p> : <div className="settlement-list">
            {data.settlements.map((settlement) => <article className="settlement-row" key={settlement.id}>
              <div><strong>{memberName(data, settlement.debtorMemberId)} → {memberName(data, settlement.creditorMemberId)}</strong><p>{settlement.merchant} · {formatCents(settlement.amountCents, settlement.currency)} · {settlement.attemptCount} attempt{settlement.attemptCount === 1 ? '' : 's'}</p><p className="event-meta">Transaction {settlement.transactionId.slice(0, 8)} · settlement {settlement.id.slice(0, 8)} · {formatEventTime(settlement.transactionCreatedAt)}</p>{settlement.failureReason && <p className="failure-reason">{settlement.failureReason}</p>}</div>
              <div className="settlement-actions"><span className={statusClass(settlement.status)}>{settlement.status}</span>{(settlement.status === 'pending' || settlement.status === 'failed') && <button className="button button-small button-secondary" type="button" onClick={() => void runSettlement(settlement, 'success')}>Process</button>}</div>
            </article>)}
          </div>}
        </div>
      </section>
    </main>
  )
}
