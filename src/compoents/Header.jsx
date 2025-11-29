import logo from '../assets/logo.png'
import React from 'react'

export default function Header({ theme, setTheme, onHome, showReset = true }){
  return (
    <div className="header container">
      <div className="brand">
        <img src={logo} alt="logo" className="logo-img" />
        <div className="title">
          <h1>Stego Vault Web</h1>
          <p>Client-side image & WAV steganography</p>
        </div>
      </div>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        { showReset && <button className="secondary small" onClick={onHome}>Home</button> }
        <button className="secondary small" onClick={()=>window.location.reload()}>Reset</button>
        <button className="small" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
          {theme === 'light' ? 'Dark' : 'Light'} Mode
        </button>
      </div>
    </div>
  )
}

