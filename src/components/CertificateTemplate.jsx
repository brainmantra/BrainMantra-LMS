import React from 'react'

export const CertificateTemplate = React.forwardRef(({ studentName, level, date }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '1123px', // A4 Landscape roughly
        height: '794px',
        padding: '40px',
        background: '#fff',
        position: 'absolute',
        top: '-10000px',
        left: '-10000px',
        zIndex: -999,
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <div style={{
        width: '100%',
        height: '100%',
        border: '15px solid #FF7A00',
        padding: '20px',
        boxSizing: 'border-box',
        position: 'relative',
        background: '#fffef5',
      }}>
        {/* Inner Border */}
        <div style={{
          width: '100%',
          height: '100%',
          border: '4px double #FF7A00',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px',
          boxSizing: 'border-box'
        }}>
          
          <h1 style={{ color: '#FF7A00', fontSize: '3rem', margin: '0 0 10px 0', fontWeight: '900', letterSpacing: '2px' }}>
            BRAIN MANTRA
          </h1>
          <h2 style={{ color: '#333', fontSize: '1.5rem', margin: '0 0 40px 0', textTransform: 'uppercase', letterSpacing: '4px' }}>
            Abacus Academy
          </h2>

          <p style={{ color: '#555', fontSize: '1.5rem', fontStyle: 'italic', margin: '0 0 20px 0' }}>
            This is to certify that
          </p>

          <h2 style={{ 
            color: '#111', 
            fontSize: '3.5rem', 
            margin: '0 0 30px 0', 
            borderBottom: '2px solid #ccc',
            display: 'inline-block',
            padding: '0 40px 10px 40px'
          }}>
            {studentName}
          </h2>

          <p style={{ color: '#555', fontSize: '1.4rem', maxWidth: '700px', lineHeight: '1.6', margin: '0 0 50px 0' }}>
            has successfully completed the grueling <b>100 Days of Abacus Challenge</b>! <br/>
            Their unwavering dedication, mental arithmetic prowess, and consistency have earned them this honor in 
            <strong style={{ color: '#FF7A00' }}> {level}</strong>.
          </p>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '80%',
            alignItems: 'flex-end',
            marginTop: 'auto'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #111', width: '200px', marginBottom: '10px', fontSize: '1.2rem', paddingBottom: '5px', color: '#111' }}>
                {date}
              </div>
              <span style={{ color: '#777', fontSize: '1.1rem' }}>Date of Completion</span>
            </div>

            {/* Gold Seal / Badge */}
            <div style={{
              width: '120px',
              height: '120px',
              background: 'radial-gradient(circle, #f5d76e, #d4af37)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              border: '4px dashed #fff',
              outline: '4px solid #d4af37'
            }}>
              <span style={{ fontSize: '3rem' }}>🏆</span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #111', width: '200px', marginBottom: '10px', height: '40px' }}>
                {/* Signature space */}
              </div>
              <span style={{ color: '#777', fontSize: '1.1rem' }}>Authorized Signature</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
})
