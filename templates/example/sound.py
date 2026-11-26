from synth import *

mix = Mix()

mix.add(pad([note("A2"), note("E3"), note("C4")], LENGTH - 0.5, cutoff=1800), 0.2, bus="music", gain=0.25)

mix.add(hit("rubber", 0.3), at(1.5), bus="fx", gain=0.9)
mix.add(pluck(note("E4"), 0.8), at(2), bus="fx", pan=-0.2, gain=0.5)

for i, n in enumerate(["A4", "C5", "E5"]):
    mix.add(mallet(note(n), 0.9), at(6 + i), bus="fx", pan=(i - 1) * 0.5, gain=0.6)

mix.add(riser(1.0), at(9), bus="fx", gain=0.25)
mix.add(kick(), at(11), bus="fx", gain=0.8)
mix.add(bell(note("A5"), 2.5), at(11.5), bus="fx", gain=0.35)

mix.duck("music", by="fx", depth=0.4)
mix.write("out/sound.wav")
