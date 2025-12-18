import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ScoreBreakdownComponent {
  label: string;
  value: number;
  maxValue?: number;
  description?: string;
  hasData?: boolean;
}

interface HealthScoreBreakdown {
  total: number;
  isEvaluable?: boolean;
  completenessPercent?: number;
  missingData?: string[];
  components: ScoreBreakdownComponent[];
}

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  breakdown?: ScoreBreakdownComponent[] | HealthScoreBreakdown;
  label?: string;
  showLabel?: boolean;
  isEvaluable?: boolean;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Attention';
  if (score >= 20) return 'Problèmes';
  return 'Critique';
};

export function ScoreRing({ 
  score, 
  size = 48, 
  strokeWidth = 4, 
  breakdown,
  label,
  showLabel = false,
  isEvaluable = true
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Extract components and metadata from breakdown
  const breakdownComponents: ScoreBreakdownComponent[] = breakdown 
    ? (Array.isArray(breakdown) ? breakdown : breakdown.components)
    : [];
  const breakdownMeta = breakdown && !Array.isArray(breakdown) ? breakdown : null;
  const effectiveIsEvaluable = breakdownMeta?.isEvaluable ?? isEvaluable;
  const completenessPercent = breakdownMeta?.completenessPercent ?? 100;
  const missingData = breakdownMeta?.missingData ?? [];
  
  // If not evaluable, show gray ring with "?"
  const displayScore = effectiveIsEvaluable ? score : 0;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;
  const scoreColor = effectiveIsEvaluable ? getScoreColor(score) : '#9ca3af';
  
  const ringContent = (
    <div 
      className="relative inline-flex items-center justify-center cursor-help"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className={`font-semibold ${effectiveIsEvaluable ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}
          style={{ fontSize: size * 0.25 }}
        >
          {effectiveIsEvaluable ? score : '?'}
        </span>
      </div>
    </div>
  );

  if (breakdownComponents.length === 0) {
    return (
      <div className="flex items-center gap-2">
        {ringContent}
        {showLabel && label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          {ringContent}
          {showLabel && label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent 
        side="top" 
        className="bg-white dark:bg-gray-900 border shadow-lg p-3 max-w-sm"
      >
        {!effectiveIsEvaluable ? (
          <>
            <p className="font-medium text-sm mb-2 text-gray-500">
              Score indisponible
            </p>
            <p className="text-xs text-gray-500 mb-2">
              Complétude des données : {completenessPercent}%
            </p>
            {missingData.length > 0 && (
              <div className="text-xs">
                <p className="text-amber-600 font-medium mb-1">Données manquantes :</p>
                <ul className="list-disc pl-4 text-gray-500 space-y-0.5">
                  {missingData.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">
                {label || 'Décomposition du score'} : {score}/100
              </p>
              {completenessPercent < 100 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  {completenessPercent}% données
                </span>
              )}
            </div>
            <div className="space-y-2">
              {breakdownComponents.map((component, idx) => {
                const hasMaxValue = component.maxValue !== undefined && component.maxValue > 0;
                const componentHasData = component.hasData !== false;
                const isNegative = component.value < 0;
                
                const formatValue = (val: number) => {
                  if (val > 0) return `+${val}`;
                  return val.toString();
                };
                
                if (hasMaxValue) {
                  const componentPercent = componentHasData 
                    ? Math.max(0, Math.min(100, (component.value / component.maxValue!) * 100))
                    : 0;
                  const componentColor = !componentHasData 
                    ? '#9ca3af' 
                    : componentPercent >= 70 ? '#10b981' : componentPercent >= 40 ? '#f59e0b' : '#ef4444';
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={componentHasData ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400 italic'}>
                          {component.label}
                        </span>
                        <span className={`font-medium ${componentHasData ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}`}>
                          {componentHasData ? `${component.value}/${component.maxValue}` : 'N/A'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: componentHasData ? `${componentPercent}%` : '0%',
                            backgroundColor: componentColor
                          }}
                        />
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <span className="text-gray-600 dark:text-gray-400">{component.label}</span>
                    <span className={`font-medium ${isNegative ? 'text-red-600' : component.value > 0 ? 'text-emerald-600' : 'text-gray-600'}`}>
                      {formatValue(component.value)} pts
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {getScoreLabel(score)}
            </p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function ScoreRingMini({ 
  score, 
  size = 32,
  breakdown
}: { 
  score: number; 
  size?: number;
  breakdown?: ScoreBreakdownComponent[];
}) {
  return (
    <ScoreRing 
      score={score} 
      size={size} 
      strokeWidth={3} 
      breakdown={breakdown}
    />
  );
}
