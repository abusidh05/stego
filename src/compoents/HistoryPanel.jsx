import React from 'react'

export default function HistoryPanel({ history }){
  return (
    <div>
      <h3 style={{marginTop:0}}>Session History</h3>
      <div className="help">Recent embed/extract operations (client-only; cleared on reload).</div>
      <div style={{height:12}}/>
      <div className="history-list">
        {history.length === 0 && <div className="help">No operations yet.</div>}
        {history.map(h => (
          <div key={h.id} className="history-item">
            <div>
              <div style={{fontSize:13,fontWeight:600}}>{h.op === 'embed' ? 'Embed' : 'Extract'} • {h.payloadType || h.filename || h.resultType}</div>
              <div className="kv">{h.carrier ? h.carrier : ''} {h.encrypted ? ' • encrypted' : ''}</div>
              <div className="kv" style={{fontSize:12}}>{h.time}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:13,color:'var(--muted)'}}>{h.op === 'embed' ? 'Done' : 'Done'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
