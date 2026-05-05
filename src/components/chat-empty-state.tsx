export function ChatEmptyState({
  onSuggest,
}: {
  onSuggest: (q: string) => void;
}) {
  const suggestions = [
    "Tóm tắt chính sách hoàn tiền",
    "Điều kiện để được hoàn tiền là gì?",
    "Có sản phẩm nào không được hoàn không?",
  ];

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-sm text-white/55">
      <p className="mb-2 text-base font-medium text-white/85">
        Bắt đầu chat với dữ liệu của bạn
      </p>
      <p className="mb-4 max-w-md">
        Đặt câu hỏi về các tài liệu đã upload, mình sẽ trả lời dựa trên nội dung
        đó.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/75 transition hover:bg-white/5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
