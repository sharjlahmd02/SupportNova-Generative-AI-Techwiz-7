export function AgentDashboard() {
  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Agent Dashboard</h1>
        <p className="page-subtitle">Assigned complaints and workload</p>
      </header>
      <div className="card">
        <h2>Assigned Complaints</h2>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Sentiment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>No assigned complaints</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}