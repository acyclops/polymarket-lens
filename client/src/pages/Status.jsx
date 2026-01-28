import { useEffect, useState } from "react";
import { getStatusInfo } from "../api/markets";
import ErrorBox from "../components/ErrorBox";

export default function Status() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStatusInfo()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    if (error) return <div className="page"><ErrorBox error={error} /></div>;
  }

  if (!status) {
    return <div className="page"><p className="muted">Loading pipeline status…</p></div>;
  }

  return (
    <div className="page">
      <h1 className="pageTitle">Pipeline Status</h1>

      <div className="statusGrid">
        <div className="panel statusCard">
          <div className="statusRow">
            <span className="statusLabel">Status</span>
            <span className={`statusPill ${status.last_run_ok ? "ok" : "fail"}`}>
              {status.last_run_ok ? "OK" : "FAILED"}
            </span>
          </div>

          <dl className="statusList">
            <div>
              <dt>Started</dt>
              <dd>{status.last_run_started_at}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{status.last_run_finished_at}</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>{status.last_processing_ms} ms</dd>
            </div>
            <div>
              <dt>Markets ingested</dt>
              <dd>{status.markets_ingested}</dd>
            </div>
            <div>
              <dt>Ticks upserted</dt>
              <dd>{status.ticks_upserted}</dd>
            </div>
            <div>
              <dt>Files ingested</dt>
              <dd>{status.files_ingested}</dd>
            </div>
            <div>
              <dt>Last snapshot</dt>
              <dd className="mono">{status.last_ingested_snapshot_file}</dd>
            </div>
          </dl>
        </div>

        {status.last_error && (
          <div className="panel errorPanel">
            <h3 className="errorTitle">Last error</h3>
            <pre className="errorBlock">{status.last_error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
