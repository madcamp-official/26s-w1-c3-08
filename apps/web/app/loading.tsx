export default function Loading() {
  return (
    <main className="maeari-loading-stage" aria-label="페이지를 불러오는 중">
      <div className="maeari-loading-scene" role="status">
        <div className="maeari-loading-envelope" aria-hidden="true">
          <div className="maeari-loading-star maeari-loading-star-main" />
          <div className="maeari-loading-star maeari-loading-star-small maeari-loading-star-one" />
          <div className="maeari-loading-star maeari-loading-star-small maeari-loading-star-two" />
          <div className="maeari-loading-envelope-back" />
          <div className="maeari-loading-envelope-flap" />
          <div className="maeari-loading-envelope-front" />
        </div>
        <p className="maeari-loading-copy">마음을 불러오고 있어요.</p>
      </div>
    </main>
  );
}
