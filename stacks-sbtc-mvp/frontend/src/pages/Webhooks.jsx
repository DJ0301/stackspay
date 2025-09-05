import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Send, Search, KeyRound } from 'lucide-react';

const initialEndpoints = [
  { id: 'wh_001', url: 'https://example.com/webhooks', description: 'Prod endpoint', secret: 'whsec_abc123', enabled: true, createdAt: '2025-08-01' },
  { id: 'wh_002', url: 'https://staging.example.com/webhooks', description: 'Staging endpoint', secret: 'whsec_def456', enabled: true, createdAt: '2025-08-05' }
];

const initialDeliveries = [
  { id: 'dlv_1001', endpointId: 'wh_001', event: 'payment.completed', status: 200, durationMs: 324, createdAt: '2025-08-30 12:31' },
  { id: 'dlv_1002', endpointId: 'wh_002', event: 'payment.failed', status: 500, durationMs: 120, createdAt: '2025-08-30 12:33' },
  { id: 'dlv_1003', endpointId: 'wh_001', event: 'payment.pending', status: 200, durationMs: 210, createdAt: '2025-08-31 09:22' }
];

function Webhooks() {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: '', description: '' });
  const [logQuery, setLogQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventType, setEventType] = useState('payment.completed');
  const [targetEndpoint, setTargetEndpoint] = useState('all');

  const filteredDeliveries = useMemo(() => {
    let list = deliveries;
    if (statusFilter !== 'all') {
      const ok = statusFilter === 'success';
      list = list.filter((d) => (ok ? d.status >= 200 && d.status < 300 : d.status >= 300));
    }
    if (targetEndpoint !== 'all') {
      list = list.filter((d) => d.endpointId === targetEndpoint);
    }
    const q = logQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => [d.id, d.event, d.createdAt].some((v) => String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [deliveries, logQuery, statusFilter, targetEndpoint]);

  const addEndpoint = (e) => {
    e.preventDefault();
    if (!form.url) return;
    const id = `wh_${(endpoints.length + 1).toString().padStart(3, '0')}`;
    const secret = `whsec_${Math.random().toString(36).slice(2, 10)}`;
    setEndpoints([{ id, url: form.url, description: form.description, secret, enabled: true, createdAt: new Date().toISOString().slice(0, 10) }, ...endpoints]);
    setForm({ url: '', description: '' });
    setShowAdd(false);
  };

  const removeEndpoint = (id) => setEndpoints(endpoints.filter((e) => e.id !== id));

  const sendTestEvent = () => {
    const candidates = targetEndpoint === 'all' ? endpoints : endpoints.filter((e) => e.id === targetEndpoint);
    if (candidates.length === 0) return;
    const now = new Date();
    const newLogs = candidates.map((ep, i) => ({
      id: `dlv_${(deliveries.length + 1 + i).toString().padStart(4, '0')}`,
      endpointId: ep.id,
      event: eventType,
      status: Math.random() > 0.2 ? 200 : 500,
      durationMs: 150 + Math.floor(Math.random() * 300),
      createdAt: `${now.toISOString().slice(0,10)} ${now.toTimeString().slice(0,5)}`
    }));
    setDeliveries([...newLogs, ...deliveries]);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-gray-300 mt-1">Manage endpoints, secrets, and inspect deliveries.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Add endpoint
        </button>
      </div>

      {/* Endpoints */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Endpoints</h2>
        <div className="space-y-4">
          {endpoints.map((e) => (
            <div key={e.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{e.url}</div>
                <div className="text-xs text-gray-500 truncate">{e.description || 'No description'}</div>
                <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <KeyRound className="w-3 h-3" /> Secret: <code className="font-mono">{e.secret}</code>
                  <button className="text-primary-600 text-xs inline-flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => removeEndpoint(e.id)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              </div>
            </div>
          ))}
          {endpoints.length === 0 && (
            <div className="text-sm text-gray-600">No endpoints yet.</div>
          )}
        </div>
      </div>

      {/* Send test event */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Send test event</h2>
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint</label>
            <select className="w-full px-3 py-2 border rounded-lg" value={targetEndpoint} onChange={(e) => setTargetEndpoint(e.target.value)}>
              <option value="all">All endpoints</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>{e.url}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event type</label>
            <select className="w-full px-3 py-2 border rounded-lg" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option>payment.completed</option>
              <option>payment.failed</option>
              <option>payment.pending</option>
            </select>
          </div>
          <div>
            <button onClick={sendTestEvent} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <Send className="w-4 h-4" /> Send event
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Delivery logs</h2>
          <div className="flex items-center gap-2">
            <select className="px-3 py-2 border rounded-lg" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Search logs"
                className="pl-9 pr-3 py-2 border rounded-lg"
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm mx-2">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Event</th>
                <th className="text-left px-4 py-3">Endpoint</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.map((d) => {
                const success = d.status >= 200 && d.status < 300;
                const ep = endpoints.find((e) => e.id === d.endpointId);
                return (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-3">{d.event}</td>
                    <td className="px-4 py-3">{ep ? ep.url : d.endpointId}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{d.durationMs} ms</td>
                    <td className="px-4 py-3">{d.createdAt}</td>
                  </tr>
                );
              })}
              {filteredDeliveries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">No deliveries</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Add endpoint</h3>
            <form onSubmit={addEndpoint} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://yourapp.com/webhooks" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Webhooks;
