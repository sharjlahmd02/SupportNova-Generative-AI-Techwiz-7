export function AdminDashboard() {
  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">System overview and analytics</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3>Total Complaints</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc' }}>0</p>
        </div>
        <div className="card">
          <h3>Pending Review</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#cc0000' }}>0</p>
        </div>
        <div className="card">
          <h3>Escalations</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff8800' }}>0</p>
        </div>
        <div className="card">
          <h3>Mismatch Rate</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8800cc' }}>0%</p>
        </div>
      </div>
      <div className="card">
        <h2>Recent Activity</h2>
        <p style={{ color: '#999' }}>No recent activity</p>
      </div>
    </div>
  )
}