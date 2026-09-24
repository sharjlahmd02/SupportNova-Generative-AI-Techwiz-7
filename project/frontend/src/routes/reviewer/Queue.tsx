import { Link } from 'react-router-dom'

export function ReviewerQueue() {
  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Manual Review Queue</h1>
        <p className="page-subtitle">Complaints requiring human review</p>
      </header>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Complaint ID</th>
              <th>Title</th>
              <th>Mismatch Fields</th>
              <th>Verification Score</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>No cases in review queue</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}