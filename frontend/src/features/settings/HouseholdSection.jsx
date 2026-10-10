import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Trash2, Users, LogOut } from 'lucide-react'
import api from '../../lib/apiClient'
import { queryClient } from '../../lib/queryClient'
import { useToast } from '../../shared/ToastContext'

export default function HouseholdSection() {
  const toast = useToast()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('MEMBER')
  const [joinToken, setJoinToken] = useState('')

  const { data: household } = useQuery({
    queryKey: ['household'],
    queryFn: () => api.get('/household').then(r => r.data),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['household'] })
    // Joining or leaving changes whose data every other endpoint returns.
    queryClient.invalidateQueries()
  }

  const inviteMutation = useMutation({
    mutationFn: body => api.post('/household/invites', body),
    onSuccess: () => {
      toast.success('Invite created — check the backend log for the token')
      setInviteEmail('')
      queryClient.invalidateQueries({ queryKey: ['household'] })
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Invite failed'),
  })

  const revokeMutation = useMutation({
    mutationFn: id => api.delete(`/household/invites/${id}`),
    onSuccess: () => {
      toast.success('Invite revoked')
      queryClient.invalidateQueries({ queryKey: ['household'] })
    },
    onError: () => toast.error('Revoke failed'),
  })

  const removeMutation = useMutation({
    mutationFn: id => api.delete(`/household/members/${id}`),
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: ['household'] })
    },
    onError: () => toast.error('Remove failed'),
  })

  const joinMutation = useMutation({
    mutationFn: token => api.post('/household/invites/accept', { token }),
    onSuccess: () => {
      toast.success('Joined household')
      setJoinToken('')
      refresh()
    },
    onError: err => toast.error(err.response?.data?.message ?? 'Could not join'),
  })

  const leaveMutation = useMutation({
    mutationFn: () => api.post('/household/leave'),
    onSuccess: () => {
      toast.success('Left household')
      refresh()
    },
    onError: () => toast.error('Could not leave'),
  })

  if (!household) return null

  if (!household.isOwner) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <div className="text-sm font-semibold text-white">Household</div>
        </div>
        <div className="text-xs text-slate-500">
          You're in <span className="text-slate-300">{household.ownerEmail}</span>'s household as a{' '}
          <span className="text-slate-300">{household.role === 'VIEWER' ? 'viewer (read-only)' : 'member'}</span>.
          Everything you see — transactions, categories, reports, net worth — is their data.
        </div>
        <button
          onClick={() => leaveMutation.mutate()}
          disabled={leaveMutation.isPending}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5" /> Leave household
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-400" />
        <div>
          <div className="text-sm font-semibold text-white">Household</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Invited people see and work on your data. A <span className="text-slate-300">member</span> can
            add and edit; a <span className="text-slate-300">viewer</span> can only read.
          </div>
        </div>
      </div>

      {household.members.length > 0 && (
        <div className="space-y-2">
          {household.members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
              <div className="text-sm text-slate-200">
                {m.email} <span className="text-xs text-slate-500 ml-1">{m.role}</span>
              </div>
              <button
                onClick={() => removeMutation.mutate(m.id)}
                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {household.invites.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">Pending invites</div>
          {household.invites.map(i => (
            <div key={i.id} className="flex items-center justify-between bg-slate-800/30 rounded-lg px-3 py-2">
              <div className="text-sm text-slate-400">
                {i.email} <span className="text-xs text-slate-600 ml-1">{i.role}</span>
              </div>
              <button
                onClick={() => revokeMutation.mutate(i.id)}
                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                title="Revoke"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end pt-2 border-t border-slate-800">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Invite by email</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="partner@example.com"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          >
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>
        <button
          onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
          disabled={!inviteEmail || inviteMutation.isPending}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Invite
        </button>
      </div>

      <div className="flex gap-2 items-end pt-2 border-t border-slate-800">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-400 mb-1">Join a household</label>
          <input
            value={joinToken}
            onChange={e => setJoinToken(e.target.value)}
            placeholder="Paste an invite token"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg"
          />
        </div>
        <button
          onClick={() => joinMutation.mutate(joinToken)}
          disabled={!joinToken || joinMutation.isPending}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-sm font-medium rounded-lg transition-colors"
        >
          Join
        </button>
      </div>
    </div>
  )
}
