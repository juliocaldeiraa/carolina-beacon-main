/**
 * BeaconBarChart — Wrapper Recharts Bar com paleta Brand
 * Cor primária das barras: #f06529
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts'

interface BeaconBarChartProps {
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

export function BeaconBarChart({
  data,
  dataKey,
  xKey = 'date',
  formatter,
  height = 80,
  color = '#f06529',
}: BeaconBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
