/**
 * BeaconLineChart — Wrapper Recharts com paleta Brand
 *
 * Spec: SPEC.md §2.3 MetricCard
 * - Cor primária das séries: #f06529 (Laranja Principal)
 * - Grid e eixos: #ebebeb (Cinza Claro)
 * - Tooltip: bg #ffffff, borda #ebebeb
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'

interface BeaconLineChartProps {
  data: Array<Record<string, unknown>>
  dataKey: string
  xKey?: string
  label?: string
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

export function BeaconLineChart({
  data,
  dataKey,
  xKey = 'date',
  formatter,
  height = 80,
  color = '#f06529',
}: BeaconLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#ebebeb" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: '#999' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.slice(5)} // show MM-DD
        />
        <YAxis hide />
        <Tooltip content={<BeaconTooltip formatter={formatter} />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
