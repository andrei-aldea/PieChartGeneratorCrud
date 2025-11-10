const getEl = (sel, root = document) => root.querySelector(sel)
const getEls = (sel, root = document) => Array.from(root.querySelectorAll(sel))

const toHex = (hex) => hex && (hex.startsWith('#') ? hex : `#${hex}`)
const formatCurrency = (n) =>
	new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(+n || 0)

const STORAGE_KEY = 'carInventory'
const saveInventory = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory))
const loadInventory = () => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

let inventory = []

function renderTable() {
	const tbody = getEl('#inventoryBody')
	tbody.innerHTML = ''

	inventory.forEach((item) => {
		const row = document.createElement('tr')
		row.innerHTML = `
      <td><input class="w-full rounded-md border border-gray-300 py-2 px-2" type="text" value="${escapeHtml(
				item.manufacturer
			)}" data-key="manufacturer" data-id="${item.id}"/></td>
      <td><input class="w-full rounded-md border border-gray-300 py-2 px-2" type="text" value="${escapeHtml(
				item.model
			)}" data-key="model" data-id="${item.id}"/></td>
      <td><input class="w-full rounded-md border border-gray-300 py-2 px-2" type="number" min="0" step="0.01" value="${
				item.price
			}" data-key="price" data-id="${item.id}"/></td>
      <td><input class="w-11 h-11 p-0 rounded-md border border-gray-300 cursor-pointer" type="color" value="${
				item.color
			}" data-key="color" data-id="${item.id}"/></td>
      <td>
        <button class="inline-flex items-center justify-center bg-red-600 text-white w-11 h-11 rounded-lg" data-action="delete" data-id="${
					item.id
				}" title="Delete">
          <svg class="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M4 7h16v2H4V7zm2 3h12l-1.2 10.2A2 2 0 0 1 14.81 22H9.19a2 2 0 0 1-1.99-1.8L6 10zm4 2h2v6h-2v-6zm4 0h2v6h-2v-6zM9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h5v2H4V4h5z"/>
          </svg>
        </button>
      </td>`
		tbody.appendChild(row)
	})

	getEls('input[data-id]', tbody).forEach((input) => {
		input.addEventListener('change', handleInlineEdit)
		input.addEventListener(
			'input',
			debounce(() => {
				saveInventory()
				queueChart()
			}, 200)
		)
	})

	getEls('button[data-action="delete"]', tbody).forEach((btn) => btn.addEventListener('click', handleRowAction))

	queueChart()
}

function handleInlineEdit(e) {
	const input = e.target
	const id = input.dataset.id
	const key = input.dataset.key
	const item = inventory.find((r) => String(r.id) === String(id))
	if (!item) return

	if (key === 'price') {
		item.price = parseFloat(input.value) || 0
		input.value = item.price
	} else if (key === 'color') {
		item.color = toHex(input.value)
	} else {
		item[key] = input.value
	}

	saveInventory()
	queueChart()
}

function handleRowAction(e) {
	const id = e.currentTarget.dataset.id
	const idx = inventory.findIndex((r) => String(r.id) === String(id))
	if (idx >= 0) {
		inventory.splice(idx, 1)
		saveInventory()
		renderTable()
	}
}

let rafHandle = null
function queueChart() {
	if (rafHandle) cancelAnimationFrame(rafHandle)
	rafHandle = requestAnimationFrame(renderChart)
}

function renderChart() {
	const canvas = getEl('#pricePie')
	if (!canvas) return
	const ctx = canvas.getContext('2d')

	// make canvas crisp on high-DPI displays while keeping logical drawing coords in CSS pixels
	const dpr = window.devicePixelRatio || 1
	const cssWidth = canvas.clientWidth || 700
	const cssHeight = canvas.clientHeight || 700
	canvas.width = Math.floor(cssWidth * dpr)
	canvas.height = Math.floor(cssHeight * dpr)
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

	ctx.clearRect(0, 0, cssWidth, cssHeight)

	const rows = inventory
	const total = rows.reduce((sum, r) => sum + (+r.price || 0), 0)
	getEl('#totalValue').textContent = formatCurrency(total)

	const errorBox = getEl('#errorBox')
	if (total <= 0 || !rows.length) {
		if (errorBox) {
			errorBox.hidden = false
			errorBox.textContent = !rows.length ? 'No data' : 'Total price is 0'
		}
		if (getEl('#legend')) getEl('#legend').innerHTML = ''
		return
	} else if (errorBox) {
		errorBox.hidden = true
	}

	const cx = cssWidth / 2
	const cy = cssHeight / 2
	const radius = Math.min(cx, cy) - 24

	let startAngle = -Math.PI / 2

	rows.forEach((item) => {
		const value = +item.price || 0
		const sliceAngle = (value / total) * Math.PI * 2
		const endAngle = startAngle + sliceAngle

		ctx.beginPath()
		ctx.moveTo(cx, cy)
		ctx.arc(cx, cy, radius, startAngle, endAngle)
		ctx.closePath()
		ctx.fillStyle = item.color || '#999'
		ctx.fill()

		ctx.lineWidth = 1.25
		ctx.strokeStyle = 'rgba(0,0,0,.18)'
		ctx.stroke()

		const mid = (startAngle + endAngle) / 2
		const labelRadius = radius * 0.72
		const lx = cx + Math.cos(mid) * labelRadius
		const ly = cy + Math.sin(mid) * labelRadius
		const pct = ((value / total) * 100).toFixed(1) + '%'

		ctx.save()
		ctx.translate(lx, ly)
		ctx.rotate(mid)
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillStyle = getContrastForHex(item.color)
		ctx.font = '700 18px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
		ctx.fillText(item.model, 0, 0)
		ctx.font = '14px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
		ctx.fillText(pct, 0, 18)
		ctx.restore()

		startAngle = endAngle
	})

	const legend = getEl('#legend')
	if (legend) {
		legend.innerHTML = ''
		rows.forEach((item) => {
			const node = document.createElement('div')
			node.className = 'flex items-center gap-3 text-base'
			const dot = document.createElement('span')
			dot.className = 'w-4 h-4 rounded-full border border-black/20 inline-block'
			dot.style.background = item.color || '#999'

			const label = document.createElement('span')
			label.innerHTML = `<strong>${escapeHtml(item.model)}</strong> • ${formatCurrency(item.price)}`

			node.appendChild(dot)
			node.appendChild(label)
			legend.appendChild(node)
		})
	}
}

getEl('#addForm').addEventListener('submit', (e) => {
	e.preventDefault()

	const manufacturer = getEl('#manufacturerInput').value.trim()
	const model = getEl('#modelInput').value.trim()
	const price = parseFloat(getEl('#priceInput').value)
	const color = toHex(getEl('#colorInput').value)

	if (!manufacturer || !model || !Number.isFinite(price) || price < 0) {
		return showToast('Please fill Manufacturer, Model and a non-negative Price.')
	}

	inventory.push({ id: generateId(), manufacturer, model, price, color })
	saveInventory()
	e.target.reset()
	getEl('#colorInput').value = color
	renderTable()
	new Audio('add.mp3').play()
})

function generateId() {
	return Math.random().toString(36).slice(2, 9)
}

function debounce(fn, ms) {
	let timer
	return (...args) => {
		clearTimeout(timer)
		timer = setTimeout(() => fn(...args), ms)
	}
}

function showToast(message) {
	const box = getEl('#errorBox')
	if (!box) return
	box.textContent = message
	box.hidden = false
	setTimeout(() => (box.hidden = true), 2600)
}

function escapeHtml(str = '') {
	return String(str).replace(
		/[&<>"']/g,
		(s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])
	)
}

function getContrastForHex(hex) {
	const h = toHex(hex) || '#000000'
	const r = parseInt(h.slice(1, 3), 16)
	const g = parseInt(h.slice(3, 5), 16)
	const b = parseInt(h.slice(5, 7), 16)

	const srgb = [r, g, b].map((v) => {
		v /= 255
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
	})
	const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
	return L > 0.55 ? '#111' : '#fff'
}

;(function init() {
	inventory = loadInventory() ?? [
		{ id: generateId(), manufacturer: 'BMW', model: '3 series', price: 40000, color: '#1B98E0' },
		{ id: generateId(), manufacturer: 'Audi', model: 'Q5', price: 41000, color: '#453603' },
		{ id: generateId(), manufacturer: 'Skoda', model: 'Kamiq', price: 15000, color: '#ff0000' }
	]
	saveInventory()
	renderTable()
})()
