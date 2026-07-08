const sproutLeafClasses = [
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-left maeari-tree-sprout-leaf-1",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-right maeari-tree-sprout-leaf-2",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-left maeari-tree-sprout-leaf-3",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-right maeari-tree-sprout-leaf-4",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-left maeari-tree-sprout-leaf-5",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-right maeari-tree-sprout-leaf-6",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-left maeari-tree-sprout-leaf-7",
  "maeari-tree-sprout-leaf maeari-tree-sprout-leaf-right maeari-tree-sprout-leaf-8",
];

export function SproutPot({ count, className = "" }: { count: number; className?: string }) {
  const visibleLeafCount = Math.min(sproutLeafClasses.length, Math.max(2, count + 2));

  return (
    <div className={`maeari-tree-sprout-wrap ${className}`} aria-label={`${count}개의 마음이 모였어요`}>
      <div className="maeari-tree-sprout">
        <div className="maeari-tree-sprout-glow" />
        <div className="maeari-tree-sprout-stem" />
        {sproutLeafClasses.slice(0, visibleLeafCount).map((leafClassName) => (
          <span key={leafClassName} className={leafClassName} />
        ))}
        <div className="maeari-tree-sprout-pot">
          <span />
        </div>
      </div>
    </div>
  );
}
