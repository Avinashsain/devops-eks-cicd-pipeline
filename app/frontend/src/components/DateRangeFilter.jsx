export function DateRangeFilter({ from, to, onFromChange, onToChange }) {
  return (
    <div className="date-filter">
      <label>
        From
        <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} />
      </label>
      {(from || to) && (
        <button
          type="button"
          className="link-button-alt"
          onClick={() => {
            onFromChange('');
            onToChange('');
          }}
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
