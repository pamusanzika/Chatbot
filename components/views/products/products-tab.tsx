'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash, Pencil, Tag as TagIcon } from 'lucide-react'
import { Card, SectionLabel } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillNav, Select, Field, Input, Textarea } from '@/components/ui/inputs'
import { IconButton } from '@/components/ui/inputs'
import { Drawer } from '@/components/ui/drawer'
import { ImgPlaceholder } from '@/components/ui/charts'
import { useCurrency } from '@/components/layout/currency-provider'
import { createClient } from '@/lib/supabase-browser'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  saveVariantAction,
  deleteVariantAction,
  adjustStockAction,
  adjustProductStockAction,
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from '@/app/(dashboard)/products/actions'
import type { Product, ProductVariant, Category, StockReason } from '@/types'

const DEFAULT_TONE = '#7c6dfa'
const CATEGORY_COLORS = ['#7c6dfa', '#2dd4a0', '#f5a623', '#ef4444', '#3b82f6', '#ec4899']

type EditingVariant = {
  id?: string
  size: string
  color_name: string
  color_hex: string
  price: string
  stock: string
  low_stock_threshold: string
  sku: string
}

const EMPTY_VARIANT: EditingVariant = {
  size: '', color_name: '', color_hex: '#7c6dfa', price: '', stock: '0', low_stock_threshold: '5', sku: '',
}

const EMPTY_PRODUCT = {
  id: undefined as string | undefined,
  name: '',
  category: '',
  base_price: '',
  description: '',
  image_urls: [] as string[],
  sku: '',
  stock: '',
  low_stock_threshold: '5',
}

export function ProductsTab({
  initialProducts,
  initialVariants,
  initialCategories,
  tenantId,
}: {
  initialProducts: Product[]
  initialVariants: ProductVariant[]
  initialCategories: Category[]
  tenantId: string
}) {
  const router = useRouter()
  const { fmt } = useCurrency()
  const [, startTransition] = useTransition()

  const [sub, setSub] = useState('Products')
  const [add, setAdd] = useState(false)
  const [addCategory, setAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0])
  const [savingCategory, setSavingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryColor, setEditCategoryColor] = useState(CATEGORY_COLORS[0])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [variantRows, setVariantRows] = useState<EditingVariant[]>([])

  const products = initialProducts
  const variants = initialVariants

  const categoryTone = useMemo(() => {
    const tones: Record<string, string> = {}
    for (const c of initialCategories) tones[c.name] = c.color
    return tones
  }, [initialCategories])

  // Categories created via the Categories tab are the source of truth.
  // Fall back to any category strings still referenced by legacy products
  // so nothing becomes invisible/unselectable.
  const categoryNames = useMemo(() => {
    const fromCategories = initialCategories.map((c) => c.name)
    const fromProducts = products.map((p) => p.category).filter((c) => !fromCategories.includes(c))
    return [...fromCategories, ...Array.from(new Set(fromProducts))]
  }, [initialCategories, products])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of categoryNames) counts[c] = 0
    for (const p of products) counts[p.category] = (counts[p.category] ?? 0) + 1
    return counts
  }, [categoryNames, products])

  async function handleCreateCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    if (categoryNames.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert('A category with this name already exists.')
      return
    }
    setSavingCategory(true)
    try {
      await createCategoryAction(name, newCategoryColor)
      setNewCategoryName('')
      setNewCategoryColor(CATEGORY_COLORS[0])
      setAddCategory(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setSavingCategory(false)
    }
  }

  function startEditCategory(c: Category) {
    setAddCategory(false)
    setEditingCategoryId(c.id)
    setEditCategoryName(c.name)
    setEditCategoryColor(c.color)
  }

  async function handleUpdateCategory(c: Category) {
    const name = editCategoryName.trim()
    if (!name) return
    if (
      name.toLowerCase() !== c.name.toLowerCase() &&
      categoryNames.some((existing) => existing.toLowerCase() === name.toLowerCase())
    ) {
      alert('A category with this name already exists.')
      return
    }
    setSavingCategory(true)
    try {
      await updateCategoryAction(c.id, { name, color: editCategoryColor }, c.name)
      setEditingCategoryId(null)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setSavingCategory(false)
    }
  }

  async function handleDeleteCategory(c: Category) {
    if ((categoryCounts[c.name] ?? 0) > 0) {
      alert('Cannot delete a category that has products assigned to it.')
      return
    }
    if (!confirm(`Delete category "${c.name}"?`)) return
    await deleteCategoryAction(c.id)
    router.refresh()
  }

  const outOfStock = products.filter((p) =>
    p.variants.length > 0 ? p.variants.every((v) => v.stock === 0) : p.base_price === 0
  ).length

  const noVariantProducts = useMemo(
    () => products.filter((p) => p.variants.length === 0),
    [products]
  )

  function stockFor(p: Product) {
    if (p.variants.length > 0) {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0)
      // A product is "low stock" if any variant is at/below its own threshold.
      const lowStock = p.variants.some((v) => v.stock > 0 && v.stock <= v.low_stock_threshold)
      return { stock, lowStock }
    }
    if (p.stock === null || p.stock === undefined) return null
    return { stock: p.stock, lowStock: p.stock > 0 && p.stock <= (p.low_stock_threshold ?? 5) }
  }

  function openAdd() {
    if (categoryNames.length === 0) {
      alert('Create a category first (Categories tab) before adding a product.')
      return
    }
    setForm({ ...EMPTY_PRODUCT, category: categoryNames[0] })
    setVariantRows([])
    setAdd(true)
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id,
      name: p.name,
      category: p.category,
      base_price: String(p.base_price),
      description: p.description ?? '',
      image_urls: p.image_urls ?? [],
      sku: p.sku ?? '',
      stock: p.stock !== null && p.stock !== undefined ? String(p.stock) : '',
      low_stock_threshold: String(p.low_stock_threshold ?? 5),
    })
    setVariantRows(
      p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color_name: v.color_name,
        color_hex: v.color_hex,
        price: String(v.price),
        stock: String(v.stock),
        low_stock_threshold: String(v.low_stock_threshold),
        sku: v.sku,
      }))
    )
    setAdd(true)
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const supabase = createClient()
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const path = `${tenantId}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('product-images').upload(path, file)
        if (error) throw error
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, ...urls] }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function addVariantRow() {
    setVariantRows((rows) => [...rows, { ...EMPTY_VARIANT }])
  }

  function updateVariantRow(i: number, patch: Partial<EditingVariant>) {
    setVariantRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function removeVariantRow(i: number) {
    const row = variantRows[i]
    if (row.id) {
      await deleteVariantAction(row.id)
    }
    setVariantRows((rows) => rows.filter((_, idx) => idx !== i))
    router.refresh()
  }

  async function handleSave() {
    if (!form.name.trim() || !form.base_price) {
      alert('Product name and base price are required.')
      return
    }
    setSaving(true)
    try {
      const hasVariants = variantRows.some((r) => r.size.trim() && r.color_name.trim())

      const productInput = {
        name: form.name.trim(),
        category: form.category,
        base_price: Number(form.base_price),
        description: form.description.trim() || null,
        image_urls: form.image_urls,
        // Direct stock tracking only applies to simple, no-variant products.
        sku: hasVariants
          ? null
          : form.sku.trim() ||
            `${form.name.trim() || 'PRD'}-${Math.random().toString(36).slice(2, 6)}`
              .toUpperCase()
              .replace(/\s+/g, '-'),
        stock: hasVariants ? null : form.stock.trim() === '' ? 0 : Number(form.stock),
        low_stock_threshold: Number(form.low_stock_threshold) || 5,
      }

      let productId = form.id
      if (productId) {
        await updateProductAction(productId, productInput)
      } else {
        const created = await createProductAction(productInput, [])
        productId = created.id
      }

      for (const row of variantRows) {
        const size = row.size.trim()
        const colorName = row.color_name.trim()
        if (!size && !colorName) continue
        if (!size || !colorName) {
          alert('Each variant needs both a size and a colour.')
          continue
        }

        const sku =
          row.sku.trim() ||
          `${form.name.trim() || 'PRD'}-${size}-${colorName}-${Math.random().toString(36).slice(2, 6)}`
            .toUpperCase()
            .replace(/\s+/g, '-')

        await saveVariantAction(productId!, {
          id: row.id,
          size,
          color_name: colorName,
          color_hex: row.color_hex,
          price: Number(row.price) || 0,
          stock: Number(row.stock) || 0,
          low_stock_threshold: Number(row.low_stock_threshold) || 0,
          sku,
        })
      }

      setAdd(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('Delete this product and all its variants?')) return
    await deleteProductAction(id)
    router.refresh()
  }

  function adjustStock(variantId: string, delta: number, reason: StockReason) {
    startTransition(async () => {
      await adjustStockAction(variantId, delta, reason)
      router.refresh()
    })
  }

  function adjustProdStock(productId: string, delta: number, reason: StockReason) {
    startTransition(async () => {
      await adjustProductStockAction(productId, delta, reason)
      router.refresh()
    })
  }

  return (
    <div className="fb-stack" style={{ gap: 18 }}>
      <div className="fb-row-between">
        <div>
          <h1 className="fb-page-title">Products</h1>
          <p className="fb-page-sub">{products.length} products · {outOfStock} out of stock</p>
        </div>
        <Button onClick={openAdd}>Add product</Button>
      </div>

      <PillNav
        items={['Products', 'Categories', 'Stock Manager']}
        value={sub}
        onChange={setSub}
      />

      {sub === 'Products' && (
        <div className="fb-grid-products">
          {products.length === 0 && (
            <Card>
              <p className="fb-muted">No products yet. Click "Add product" to create your first one.</p>
            </Card>
          )}
          {products.map((p) => {
            const tone = categoryTone[p.category] ?? DEFAULT_TONE
            const stock = stockFor(p)
            return (
              <div className="fb-product-card" key={p.id}>
                <div className="fb-product-img">
                  {p.image_urls?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_urls[0]} alt={p.name} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                  ) : (
                    <ImgPlaceholder label="product shot" height={180} />
                  )}
                  <div className="fb-product-overlay">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                    <button
                      className="fb-iconbtn"
                      style={{ background: 'rgba(255,255,255,0.9)', color: '#111' }}
                      onClick={() => handleDeleteProduct(p.id)}
                      title="Delete product"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                <div className="fb-product-body">
                  <div className="fb-row-between">
                    <span className="fb-strong">{p.name}</span>
                    <Badge tone={tone} outline>{p.category}</Badge>
                  </div>
                  <div className="fb-row-between" style={{ marginTop: 6 }}>
                    <span className="mono fb-strong">{fmt(p.base_price)}</span>
                    {stock === null ? (
                      <Badge tone="gray" dot>No variants</Badge>
                    ) : (
                      <Badge tone={stock.stock === 0 ? 'red' : stock.lowStock ? 'amber' : 'teal'} dot>
                        {stock.stock === 0 ? 'Out of stock' : stock.lowStock ? `${stock.stock} low stock` : `${stock.stock} in stock`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {sub === 'Categories' && (
        <Card>
          <div className="fb-row-between" style={{ marginBottom: 12 }}>
            <SectionLabel>Categories</SectionLabel>
            <Button variant="secondary" size="sm" onClick={() => setAddCategory((v) => !v)}>
              {addCategory ? 'Cancel' : '+ Add category'}
            </Button>
          </div>

          {addCategory && (
            <div className="fb-row-between" style={{ gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
              <Field label="Category name">
                <Input
                  full
                  value={newCategoryName}
                  placeholder="e.g. Jackets"
                  onChange={setNewCategoryName}
                />
              </Field>
              <div className="fb-cat-swatches">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`fb-cat-swatch${newCategoryColor === color ? ' active' : ''}`}
                    onClick={() => setNewCategoryColor(color)}
                    style={{ background: color }}
                  />
                ))}
              </div>
              <Button onClick={handleCreateCategory} disabled={savingCategory}>
                {savingCategory ? 'Saving…' : 'Save'}
              </Button>
            </div>
          )}

          {categoryNames.length === 0 && !addCategory && (
            <p className="fb-muted">No categories yet. Click "+ Add category" to create one.</p>
          )}

          <div className="fb-cat-grid">
            {categoryNames.map((c) => {
              const cat = initialCategories.find((ic) => ic.name === c)

              if (cat && editingCategoryId === cat.id) {
                return (
                  <div className="fb-cat-row" key={c} style={{ flexWrap: 'wrap' }}>
                    <Input value={editCategoryName} onChange={setEditCategoryName} placeholder="Category name" />
                    <div className="fb-cat-swatches">
                      {CATEGORY_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`fb-cat-swatch${editCategoryColor === color ? ' active' : ''}`}
                          onClick={() => setEditCategoryColor(color)}
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                    <div className="fb-cat-actions">
                      <Button size="sm" onClick={() => handleUpdateCategory(cat)} disabled={savingCategory}>
                        {savingCategory ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>Cancel</Button>
                    </div>
                  </div>
                )
              }

              return (
                <div className="fb-cat-row" key={c}>
                  <TagIcon size={16} style={{ color: categoryTone[c] ?? DEFAULT_TONE, flexShrink: 0 }} />
                  <span className="fb-strong">{c}</span>
                  <span className="fb-muted mono">{categoryCounts[c] ?? 0} items</span>
                  {cat && (
                    <div className="fb-cat-actions">
                      <IconButton icon={Pencil} onClick={() => startEditCategory(cat)} title="Edit category" />
                      <IconButton icon={Trash} tone="#ef4444" onClick={() => handleDeleteCategory(cat)} title="Delete category" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {sub === 'Stock Manager' && (
        <Card pad={0}>
          <div className="fb-table-scroll">
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Variant</th><th>SKU</th><th className="num">Price</th>
                  <th className="ctr">Adjust</th><th className="num">Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 && noVariantProducts.length === 0 && (
                  <tr><td colSpan={5} className="fb-muted">No products or variants yet.</td></tr>
                )}
                {variants.map((v) => (
                  <StockRow
                    key={v.id}
                    variant={v}
                    productName={products.find((p) => p.id === v.product_id)?.name}
                    onAdjust={adjustStock}
                  />
                ))}
                {noVariantProducts.map((p) => (
                  <ProductStockRow key={p.id} product={p} onAdjust={adjustProdStock} onEdit={() => openEdit(p)} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit product drawer */}
      <Drawer
        open={add}
        onClose={() => setAdd(false)}
        title={form.id ? 'Edit product' : 'Add product'}
        subtitle={form.id ? form.name : 'New item'}
      >
        <div className="fb-add-product">
          <div>
            <SectionLabel>Images</SectionLabel>
            <label className="fb-dropzone" style={{ cursor: 'pointer' }}>
              <Upload size={22} />
              <span>{uploading ? 'Uploading…' : 'Drag & drop or click to upload'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleImageUpload(e.target.files)}
              />
            </label>
            <div className="fb-thumb-row">
              {form.image_urls.length === 0 &&
                [1, 2, 3].map((i) => <ImgPlaceholder key={i} label="" height={56} radius={8} />)}
              {form.image_urls.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const supabase = createClient()
                        // Extract storage path from public URL: everything after /product-images/
                        const match = url.match(/\/product-images\/(.+)$/)
                        if (match) {
                          await supabase.storage.from('product-images').remove([match[1]])
                        }
                      } catch {
                        // best-effort; still remove from form
                      }
                      setForm((f) => ({ ...f, image_urls: f.image_urls.filter((_, j) => j !== i) }))
                    }}
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.65)', border: 'none',
                      color: '#fff', fontSize: 11, lineHeight: '18px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="fb-stack" style={{ gap: 14 }}>
            <Field label="Product name">
              <Input full value={form.name} placeholder="e.g. Cotton Sarong" onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            </Field>
            <Field label="Category">
              <Select full value={form.category} options={categoryNames} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
            </Field>
            <Field label="Base price (LKR)">
              <Input full value={form.base_price} placeholder="1500" mono onChange={(v) => setForm((f) => ({ ...f, base_price: v.replace(/[^0-9.]/g, '') }))} />
            </Field>
            <Field label="Description">
              <Textarea rows={2} placeholder="Short description…" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
            </Field>

            {variantRows.length === 0 && (
              <>
                <Field label="SKU" hint="Leave blank to auto-generate one">
                  <Input full value={form.sku} placeholder="e.g. SOCK-WHT-01 (auto-generated if blank)" mono onChange={(v) => setForm((f) => ({ ...f, sku: v }))} />
                </Field>
                <Field label="Stock">
                  <Input full value={form.stock} placeholder="0" mono onChange={(v) => setForm((f) => ({ ...f, stock: v.replace(/[^0-9]/g, '') }))} />
                </Field>
                <Field label="Low stock threshold">
                  <Input full value={form.low_stock_threshold} placeholder="5" mono onChange={(v) => setForm((f) => ({ ...f, low_stock_threshold: v.replace(/[^0-9]/g, '') }))} />
                </Field>
              </>
            )}
          </div>
        </div>

        {/* Variants table */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>Variants</SectionLabel>
          <div className="fb-table-scroll" style={{ marginTop: 10 }}>
            <table className="fb-table">
              <thead>
                <tr>
                  <th>Size</th><th>Colour</th><th className="num">Price</th>
                  <th className="num">Stock</th><th className="num">Min</th><th>SKU</th><th></th>
                </tr>
              </thead>
              <tbody>
                {variantRows.map((v, i) => (
                  <tr key={v.id ?? `new-${i}`}>
                    <td><Input value={v.size} onChange={(val) => updateVariantRow(i, { size: val })} placeholder="M" mono /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={v.color_hex}
                          onChange={(e) => updateVariantRow(i, { color_hex: e.target.value })}
                          style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none' }}
                        />
                        <Input value={v.color_name} onChange={(val) => updateVariantRow(i, { color_name: val })} placeholder="Navy" />
                      </div>
                    </td>
                    <td><Input value={v.price} onChange={(val) => updateVariantRow(i, { price: val.replace(/[^0-9.]/g, '') })} mono /></td>
                    <td><Input value={v.stock} onChange={(val) => updateVariantRow(i, { stock: val.replace(/[^0-9]/g, '') })} mono /></td>
                    <td><Input value={v.low_stock_threshold} onChange={(val) => updateVariantRow(i, { low_stock_threshold: val.replace(/[^0-9]/g, '') })} mono /></td>
                    <td><Input value={v.sku} onChange={(val) => updateVariantRow(i, { sku: val })} placeholder="SKU-001" mono /></td>
                    <td><IconButton icon={Trash} tone="#ef4444" onClick={() => removeVariantRow(i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="ghost" size="sm" style={{ marginTop: 8 }} onClick={addVariantRow}>+ Add variant row</Button>
        </div>

        <div className="fb-row-between" style={{ marginTop: 20 }}>
          <Button variant="ghost" onClick={() => setAdd(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Saving…' : 'Save product'}
          </Button>
        </div>
      </Drawer>
    </div>
  )
}

function ProductStockRow({
  product,
  onAdjust,
  onEdit,
}: {
  product: Product
  onAdjust: (productId: string, delta: number, reason: StockReason) => void
  onEdit: () => void
}) {
  const { fmt } = useCurrency()
  const stock = product.stock ?? 0
  const threshold = product.low_stock_threshold ?? 5

  return (
    <tr>
      <td>
        <div className="fb-user-cell">
          <span className="fb-strong">{product.name}</span>
        </div>
      </td>
      <td className="mono fb-muted" style={{ fontSize: 13 }}>
        {product.sku || (
          <button onClick={onEdit} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
            Set SKU
          </button>
        )}
      </td>
      <td className="num mono">{fmt(product.base_price)}</td>
      <td className="ctr">
        <div className="fb-stepper">
          <button onClick={() => onAdjust(product.id, -1, 'Adjustment')}>−</button>
          <button onClick={() => onAdjust(product.id, 1, 'Adjustment')}>+</button>
        </div>
      </td>
      <td className="num mono fb-strong">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {stock}
          {stock === 0 ? (
            <Badge tone="red" dot>Out</Badge>
          ) : stock <= threshold ? (
            <Badge tone="amber" dot>Low</Badge>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function StockRow({
  variant,
  productName,
  onAdjust,
}: {
  variant: ProductVariant
  productName?: string
  onAdjust: (variantId: string, delta: number, reason: StockReason) => void
}) {
  const { fmt } = useCurrency()
  return (
    <tr>
      <td>
        <div className="fb-user-cell">
          <span className="fb-cdot" style={{ background: variant.color_hex }} />
          <span className="fb-strong">
            {productName ? `${productName} · ` : ''}{variant.color_name} · {variant.size}
          </span>
        </div>
      </td>
      <td className="mono fb-muted" style={{ fontSize: 13 }}>{variant.sku}</td>
      <td className="num mono">{fmt(variant.price)}</td>
      <td className="ctr">
        <div className="fb-stepper">
          <button onClick={() => onAdjust(variant.id, -1, 'Adjustment')}>−</button>
          <button onClick={() => onAdjust(variant.id, 1, 'Adjustment')}>+</button>
        </div>
      </td>
      <td className="num mono fb-strong">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {variant.stock}
          {variant.stock === 0 ? (
            <Badge tone="red" dot>Out</Badge>
          ) : variant.stock <= variant.low_stock_threshold ? (
            <Badge tone="amber" dot>Low</Badge>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
