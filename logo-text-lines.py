import math
startAngle = 3
endAngle = 23

startX = 150 + 100 * math.cos(startAngle * math.pi/180)
startY = 150 + 100 * math.sin(startAngle * math.pi/180)
endX   = 150 + 100 * math.cos(endAngle * math.pi/180)
endY   = 150 + 100 * math.sin(endAngle * math.pi/180)

print("""                <!-- StartAngle: {}, EndAngle: {} -->""".format(startAngle, endAngle))
print("""                <path d="M {:.2f},{:.2f} A 100,100 0 0,1{:.2f},{:.2f}" stroke="black" stroke-width="1" fill="none" />""".format(startX, startY, endX, endY))

