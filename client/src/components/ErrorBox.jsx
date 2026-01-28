export default function ErrorBox({ error }) {
  if (!error) return null;

  return (
    <div className="error-box">
      <strong>Error:</strong> {String(error.message ?? error)}
    </div>
  );
}
