export default function Home() {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '40px', maxWidth: '600px' }}>
      <h1>Cominiti API Server</h1>
      <p>This is the backend API server for Cominiti.</p>
      
      <h2>Available Endpoints:</h2>
      <ul>
        <li><code>/api/ai/*</code> - AI services (contract generator, email generator, rate estimator)</li>
        <li><code>/api/brands/*</code> - Brand management</li>
        <li><code>/api/creators/*</code> - Creator management</li>
        <li><code>/api/generate-portfolio</code> - Portfolio generation</li>
        <li><code>/api/instagram/*</code> - Instagram integration</li>
        <li><code>/api/orders/*</code> - Order management</li>
      </ul>
      
      <h2>Status:</h2>
      <p style={{ color: 'green' }}>✓ Server is running</p>
    </div>
  );
}
