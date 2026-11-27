$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# Build custom Windows AppX tile artwork instead of electron-builder's default sample logos.
$assetDir = Join-Path $PSScriptRoot "..\\build\\appx"
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null

function Draw-VercetiMark {
    param([System.Drawing.Graphics]$Graphics, [float]$X, [float]$Y, [float]$Size)
    $points = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new($X + 0.12 * $Size, $Y + 0.12 * $Size),
        [System.Drawing.PointF]::new($X + 0.34 * $Size, $Y + 0.12 * $Size),
        [System.Drawing.PointF]::new($X + 0.50 * $Size, $Y + 0.70 * $Size),
        [System.Drawing.PointF]::new($X + 0.66 * $Size, $Y + 0.12 * $Size),
        [System.Drawing.PointF]::new($X + 0.88 * $Size, $Y + 0.12 * $Size),
        [System.Drawing.PointF]::new($X + 0.59 * $Size, $Y + 0.88 * $Size),
        [System.Drawing.PointF]::new($X + 0.41 * $Size, $Y + 0.88 * $Size)
    )
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddPolygon($points)
    $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.RectangleF]::new($X, $Y, $Size, $Size),
        [System.Drawing.Color]::FromArgb(216, 186, 255),
        [System.Drawing.Color]::FromArgb(103, 37, 189),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $Graphics.FillPath($gradient, $path)
    $gradient.Dispose()
    $path.Dispose()
}

function New-VercetiTile {
    param([string]$FileName, [int]$Width, [int]$Height, [bool]$Wide = $false)
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::FromArgb(14, 11, 24))
    $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(95, 168, 85, 255), [Math]::Max(1.0, $Width / 120.0))
    $graphics.DrawRectangle($border, 1, 1, ($Width - 3), ($Height - 3))
    $border.Dispose()

    if ($Wide) {
        $markSize = [Math]::Min($Height * 0.82, $Width * 0.35)
        Draw-VercetiMark -Graphics $graphics -X ($Height * 0.08) -Y (($Height - $markSize) / 2) -Size $markSize
        $fontSize = [Math]::Max(12.0, $Height * 0.22)
        $font = [System.Drawing.Font]::new("Segoe UI Semibold", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(238, 230, 214, 255))
        $graphics.DrawString("VERCETI", $font, $brush, [float]($Height * 0.95), [float](($Height - $fontSize) / 2 - 2))
        $brush.Dispose()
        $font.Dispose()
    } else {
        $markSize = [Math]::Min($Width, $Height) * 0.78
        Draw-VercetiMark -Graphics $graphics -X (($Width - $markSize) / 2) -Y (($Height - $markSize) / 2) -Size $markSize
    }

    $bitmap.Save((Join-Path $assetDir $FileName), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Host "Generated $FileName ($Width x $Height)"
}

New-VercetiTile "StoreLogo.png" 50 50
New-VercetiTile "Square44x44Logo.png" 44 44
New-VercetiTile "Square150x150Logo.png" 150 150
New-VercetiTile "Wide310x150Logo.png" 310 150 $true
New-VercetiTile "SmallTile.png" 71 71
New-VercetiTile "LargeTile.png" 310 310
Write-Host "All custom VERCETI AppX tile images generated."
