import { Link } from "react-router-dom";

export default function MarketList({ markets }) {
  if (!markets?.length) return null;

  return (
    <ul className="marketList">
      {markets.map((m) => (
        <li key={m.slug} className="marketItem">
          <Link to={`/markets/${m.slug}`}
          className="marketItemLink"
          state={{ question: m.question }}>
            {m.question}
          </Link>
        </li>
      ))}
    </ul>
  );
}
