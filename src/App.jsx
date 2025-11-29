import React, { useState } from 'react'
import Header from './components/Header'
import EmbedPanel from './components/EmbedPanel'
import ExtractPanel from './components/ExtractPanel'
import HistoryPanel from './components/HistoryPanel'

export default function App(){
  const [history, setHistory] = useState([])
  const [theme, setTheme] = useState('dark') // 'dark' or 'light'
  const [view, setView] = useState(null) // null = chooser, 'embed', 'extract'

  const pushHistory = (entry) => {
    const item = { id: Date.now(), time: new Date().toLocaleString(), ...entry }
    setHistory(prev => [item, ...prev].slice(0, 50))
  }

  // initial chooser screen
  if(!view){
    return (
      <div className={theme === 'light' ? 'light' : ''}>
        <div className="container" style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
          <Header theme={theme} setTheme={setTheme} onHome={()=>{}} showReset={false}/>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div className="chooser-card card">
              <h1 style={{margin:0}}>Stego Vault Web</h1>
              <p className="panel-desc" style={{marginTop:6}}>Embed or extract secret text/files — fully client-side.</p>
              <div style={{height:18}}/>
              <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'center'}}>
                <button className="hero" onClick={()=>setView('embed')}>Embed to a file</button>
                <button className="hero secondary" onClick={()=>setView('extract')}>Extract from a file</button>
              </div>
              <div style={{height:12}}/>
              <div className="help">Quick: choose an action to continue</div>
            </div>
          </div>
          <div style={{padding:18, textAlign:'center'}} className="help">Tip: Use PNG for images (lossless). This is a client-side tool — files never leave your browser.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={theme === 'light' ? 'light' : ''}>
      <div className="container">
        <Header theme={theme} setTheme={setTheme} onHome={()=>setView(null)} showReset={true} />
        <div className="main">
          <div className="card">
            <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:8, justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>{view === 'embed' ? 'Embed (Encode)' : 'Extract (Decode)'}</h2>
              <div className="help">{view === 'embed' ? 'Embed secret text/files into PNG or WAV carriers.' : 'Upload a stego PNG or WAV to extract hidden data.'}</div>
            </div>
            <div className="panels">
              { view === 'embed' ? <EmbedPanel pushHistory={pushHistory}/> : <ExtractPanel pushHistory={pushHistory}/> }
            </div>
            <div className="footer">Output files are generated as downloads. Everything runs in your browser.</div>
          </div>

          <div className="card">
            <HistoryPanel history={history} />
          </div>
        </div>
      </div>
    </div>
  )
}

