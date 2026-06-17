'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Edit, Trash } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Field } from '@/components/ui/inputs'
import { Toggle } from '@/components/ui/toggle'
import { IconButton } from '@/components/ui/inputs'
import { Drawer } from '@/components/ui/drawer'
import { useCurrency } from '@/components/layout/currency-provider'
import { saveZoneAction, toggleZoneAction, deleteZoneAction } from '@/app/(dashboard)/delivery/actions'
import type { DeliveryZone } from '@/types'

function groupByProvince(zones: DeliveryZone[]) {
  return zones.reduce<Record<string, DeliveryZone[]>>((acc, z) => {
    if (!acc[z.province]) acc[z.province] = []
    acc[z.province].push(z)
    return acc
  }, {})
}

type EditingZone = {
  id?: string
  zone_type: 'province' | 'flat_rate' | 'worldwide'
  province: string
  district: string
  cities: string
  fee: string
  estimated_days: string
  free_delivery_threshold: string
  is_active: boolean
}

const EMPTY_ZONE: EditingZone = {
  zone_type: 'province',
  province: '',
  district: '',
  cities: '',
  fee: '',
  estimated_days: '',
  free_delivery_threshold: '',
  is_active: true,
}

export function DeliveryTab({ initialZones }: { initialZones: DeliveryZone[] }) {
  const { fmt } = useCurrency()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [zones, setZones] = useState<DeliveryZone[]>(initialZones)
  const [openProvinces, setOpenProvinces] = useState<Set<string>>(
    new Set(initialZones.length ? [initialZones[0].province] : [])
  )
  const [calc, setCalc] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [editing, setEditing] = useState<EditingZone>(EMPTY_ZONE)
  const [saving, setSaving] = useState(false)

  const provinceZones = zones.filter((z) => z.zone_type === 'province' || !z.zone_type)
  const flatRateZone = zones.find((z) => z.zone_type === 'flat_rate')
  const worldwideZones = zones.filter((z) => z.zone_type === 'worldwide')

  const grouped = groupByProvince(provinceZones)

  const toggleProvince = (p: string) => {
    setOpenProvinces((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const allCities = provinceZones.flatMap((z) => z.cities.map((c) => ({ c, zone: z })))
  const match = calc
    ? allCities.find(({ c }) => c.toLowerCase().includes(calc.toLowerCase()))?.zone
    : undefined

  const openAdd = (zoneType: 'province' | 'flat_rate' | 'worldwide') => {
    setEditing({ ...EMPTY_ZONE, zone_type: zoneType })
    setDrawer(true)
  }

  const openEdit = (zone: DeliveryZone) => {
    setEditing({
      id: zone.id,
      zone_type: zone.zone_type ?? 'province',
      province: zone.province,
      district: zone.district,
      cities: zone.cities.join(', '),
      fee: String(zone.fee),
      estimated_days: zone.estimated_days,
      free_delivery_threshold: String(zone.free_delivery_threshold),
      is_active: zone.is_active,
    })
    setDrawer(true)
  }

  const handleToggle = (zone: DeliveryZone) => {
    const next = !zone.is_active
    setZones((prev) => prev.map((z) => (z.id === zone.id ? { ...z, is_active: next } : z)))
    startTransition(async () => {
      await toggleZoneAction(zone.id, next)
      router.refresh()
    })
  }

  const handleDelete = (zone: DeliveryZone) => {
    if (!confirm(`Delete the ${zone.district} zone?`)) return
    setZones((prev) => prev.filter((z) => z.id !== zone.id))
    startTransition(async () => {
      await deleteZoneAction(zone.id)
      router.refresh()
    })
  }

  const handleSave = async () => {
    const isFlatRate = editing.zone_type === 'flat_rate'
    if (!isFlatRate && !editing.province.trim()) return
    if (!isFlatRate && !editing.district.trim()) return
    setSaving(true)
    try {
      await saveZoneAction({
        id: editing.id,
        zone_type: editing.zone_type ?? 'province',
        province: isFlatRate ? 'Sri Lanka' : editing.province.trim(),
        district: isFlatRate ? 'All Areas' : editing.district.trim(),
        cities: isFlatRate ? [] : editing.cities.split(',').map((c) => c.trim()).filter(Boolean),
        fee: Number(editing.fee) || 0,
        estimated_days: editing.estimated_days.trim(),
        free_delivery_threshold: Number(editing.free_delivery_threshold) || 0,
        is_active: editing.is_active,
      })
      setDrawer(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Delivery Fees</h1>
          <p className="fb-page-sub">Island-wide zones, fees and estimated days.</p>
        </div>
        <Button onClick={() => openAdd('province')}>Add zone</Button>
      </div>

      {/* Sri Lanka Flat Rate */}
      <Card>
        <div className="fb-row-between" style={{ marginBottom: 12 }}>
          <SectionLabel>Sri Lanka — Flat Rate</SectionLabel>
          {!flatRateZone && (
            <Button size="sm" variant="ghost" onClick={() => openAdd('flat_rate')}>
              Set flat rate
            </Button>
          )}
        </div>
        {flatRateZone ? (
          <div className="fb-zone-row">
            <div className="fb-zone-name">
              <div className="fb-strong">All Sri Lanka Areas</div>
              <div className="fb-muted" style={{ fontSize: 13 }}>
                Single rate applied to every city island-wide
              </div>
            </div>
            <Badge tone="purple">{fmt(flatRateZone.fee)}</Badge>
            <Badge tone="gray">{flatRateZone.estimated_days} days</Badge>
            <Toggle size="sm" on={flatRateZone.is_active} onChange={() => handleToggle(flatRateZone)} />
            <IconButton icon={Edit} title="Edit" onClick={() => openEdit(flatRateZone)} />
            <IconButton icon={Trash} title="Delete" onClick={() => handleDelete(flatRateZone)} />
          </div>
        ) : (
          <p className="fb-muted" style={{ fontSize: 13 }}>
            No flat rate set. Use this when you charge the same delivery fee everywhere in Sri Lanka.
          </p>
        )}
      </Card>

      {/* Province-based Zones accordion */}
      <Card pad={0}>
        <div className="fb-row-between" style={{ padding: '14px 16px 0' }}>
          <SectionLabel>Sri Lanka — Province Zones</SectionLabel>
        </div>
        {Object.keys(grouped).length === 0 && (
          <div style={{ padding: 24 }} className="fb-muted">
            No province zones yet. Click &quot;Add zone&quot; to create one.
          </div>
        )}
        {Object.entries(grouped).map(([province, districts]) => {
          const open = openProvinces.has(province)
          return (
            <div className="fb-accordion" key={province}>
              <button className="fb-acc-head" onClick={() => toggleProvince(province)}>
                <span className={`fb-acc-chev${open ? ' open' : ''}`}>
                  <ChevronRight size={16} />
                </span>
                <span className="fb-strong">{province} Province</span>
                <span className="fb-muted" style={{ fontSize: 13 }}>
                  {districts.length} district{districts.length !== 1 ? 's' : ''}
                </span>
              </button>

              {open && (
                <div className="fb-acc-body">
                  {districts.map((d) => (
                    <div className="fb-zone-row" key={d.id}>
                      <div className="fb-zone-name">
                        <div className="fb-strong">{d.district}</div>
                        <div className="fb-zone-cities">
                          {d.cities.map((c) => (
                            <span className="fb-citytag" key={c}>{c}</span>
                          ))}
                        </div>
                      </div>
                      <Badge tone="purple">{fmt(d.fee)}</Badge>
                      <Badge tone="gray">{d.estimated_days} days</Badge>
                      <Toggle size="sm" on={d.is_active} onChange={() => handleToggle(d)} />
                      <IconButton icon={Edit} title="Edit" onClick={() => openEdit(d)} />
                      <IconButton icon={Trash} title="Delete" onClick={() => handleDelete(d)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* Worldwide Delivery */}
      <Card pad={0}>
        <div className="fb-row-between" style={{ padding: '14px 16px 10px' }}>
          <SectionLabel>Worldwide Delivery</SectionLabel>
          <Button size="sm" variant="ghost" onClick={() => openAdd('worldwide')}>
            Add country
          </Button>
        </div>
        {worldwideZones.length === 0 ? (
          <div style={{ padding: '0 16px 16px', fontSize: 13 }} className="fb-muted">
            No worldwide zones yet. Add a country or region to enable international delivery.
          </div>
        ) : (
          <div className="fb-acc-body">
            {worldwideZones.map((d) => (
              <div className="fb-zone-row" key={d.id}>
                <div className="fb-zone-name">
                  <div className="fb-strong">{d.province}</div>
                  {d.district && <div className="fb-muted" style={{ fontSize: 13 }}>{d.district}</div>}
                </div>
                <Badge tone="purple">{fmt(d.fee)}</Badge>
                <Badge tone="gray">{d.estimated_days} days</Badge>
                <Toggle size="sm" on={d.is_active} onChange={() => handleToggle(d)} />
                <IconButton icon={Edit} title="Edit" onClick={() => openEdit(d)} />
                <IconButton icon={Trash} title="Delete" onClick={() => handleDelete(d)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delivery Calculator */}
      <Card>
        <SectionLabel>Delivery Calculator</SectionLabel>
        <div className="fb-row-between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 12 }}>
          <Input
            placeholder="Type a city…"
            value={calc}
            onChange={setCalc}
            style={{ width: 280 }}
          />
          {match ? (
            <div style={{ fontSize: 14 }}>
              <span className="fb-muted">Fee</span>{' '}
              <b className="mono">{fmt(match.fee)}</b>
              {' · '}
              <span className="fb-muted">{match.estimated_days} days</span>
              {' · '}
              <span className="fb-muted">free over</span>{' '}
              <b className="mono">{fmt(match.free_delivery_threshold)}</b>
            </div>
          ) : (
            <span className="fb-muted">
              {calc ? 'No zone found for that city.' : 'Start typing a city name.'}
            </span>
          )}
        </div>
      </Card>

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={editing.id ? 'Edit zone' : 'Add zone'}
        subtitle={
          editing.zone_type === 'flat_rate'
            ? 'Sri Lanka flat rate'
            : editing.zone_type === 'worldwide'
            ? 'Worldwide delivery'
            : 'Delivery zone'
        }
        width={480}
      >
        <div className="fb-stack" style={{ gap: 14 }}>
          {editing.zone_type === 'flat_rate' && (
            <p className="fb-muted" style={{ fontSize: 13, marginBottom: 4 }}>
              This fee applies to all cities in Sri Lanka.
            </p>
          )}

          {editing.zone_type === 'province' && (
            <>
              <Field label="Province">
                <Input value={editing.province} onChange={(v) => setEditing((e) => ({ ...e, province: v }))} placeholder="e.g. Western" full />
              </Field>
              <Field label="District">
                <Input value={editing.district} onChange={(v) => setEditing((e) => ({ ...e, district: v }))} placeholder="e.g. Colombo" full />
              </Field>
              <Field label="Cities" hint="Comma separated">
                <Input value={editing.cities} onChange={(v) => setEditing((e) => ({ ...e, cities: v }))} placeholder="e.g. Dehiwala, Mount Lavinia" full />
              </Field>
            </>
          )}

          {editing.zone_type === 'worldwide' && (
            <>
              <Field label="Country / Region">
                <Input value={editing.province} onChange={(v) => setEditing((e) => ({ ...e, province: v }))} placeholder="e.g. United Kingdom" full />
              </Field>
              <Field label="Sub-region" hint="Optional">
                <Input value={editing.district} onChange={(v) => setEditing((e) => ({ ...e, district: v }))} placeholder="e.g. Europe" full />
              </Field>
            </>
          )}

          <Field label="Delivery fee">
            <Input value={editing.fee} onChange={(v) => setEditing((e) => ({ ...e, fee: v }))} type="number" full />
          </Field>
          <Field label="Estimated days">
            <Input value={editing.estimated_days} onChange={(v) => setEditing((e) => ({ ...e, estimated_days: v }))} placeholder="e.g. 1-2" full />
          </Field>
          <Field label="Free delivery threshold">
            <Input value={editing.free_delivery_threshold} onChange={(v) => setEditing((e) => ({ ...e, free_delivery_threshold: v }))} type="number" full />
          </Field>
          <Field label="Active">
            <Toggle on={editing.is_active} onChange={(v) => setEditing((e) => ({ ...e, is_active: v }))} />
          </Field>
          <Button onClick={handleSave} disabled={saving} full>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Drawer>
    </div>
  )
}
