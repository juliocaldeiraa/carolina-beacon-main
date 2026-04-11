/**
 * BeaconAreaChart — Wrapper Recharts Area com paleta Brand
 * Gradiente: #f06529 → transparente
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'

interface BeaconAreaChartProps {
  data: Array<Record<string, unknown>>
  dataKey: string
  xKey?: string
  formatter?: (value: number) => string
  height?: number
  color?: string
}

function BeaconTooltip({ active, payload, label, formatter }: TooltipProps<number, string> & { formatter?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-beacon-gray rounded-lg shadow-card px-3 py-2 text-xs">
      <p className="text-[#666] mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold text-beacon-black">
          {formatter ? formatter(p.value as number) : p.value}
        </p>
      ))}
    </div>
  )
}

export function BeaconAreaChart({
  data,
  dataKey,
  xKey = 'date',
  formatter,
  height = 80,
  color = '#f06529',
}: BeaconAreaChartProps) {
  const gradId = `beacon-grad-${dataKey}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: '#999' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis hide />
        <Tooltip content={<BeaconTooltip formatter={formatter} />} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
