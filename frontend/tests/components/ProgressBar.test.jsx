import { render, screen } from '@testing-library/react'
import { ProgressBar } from '../../src/components/ui/ProgressBar'

describe('ProgressBar', () => {
  test('показывает правильный процент', () => {
    const { container } = render(<ProgressBar paid={5000} total={10000} />)
    const fill = container.querySelector('[style*="width"]')
    expect(fill.style.width).toBe('50%')
  })

  test('не превышает 100% при переплате', () => {
    const { container } = render(<ProgressBar paid={15000} total={10000} />)
    const fill = container.querySelector('[style*="width"]')
    expect(fill.style.width).toBe('100%')
  })

  test('показывает сумму и валюту', () => {
    render(<ProgressBar paid={5000} total={10000} currency="UAH" />)
    expect(screen.getByText(/5 000 UAH/)).toBeInTheDocument()
    expect(screen.getByText(/из 10 000/)).toBeInTheDocument()
  })

  test('0% при paid=0', () => {
    const { container } = render(<ProgressBar paid={0} total={10000} />)
    const fill = container.querySelector('[style*="width"]')
    expect(fill.style.width).toBe('0%')
  })
})
