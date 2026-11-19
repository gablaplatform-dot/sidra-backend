import 'package:flutter/material.dart';

/// A small static texture tile with translucent light and dark specks.
const backgroundGrain = BoxDecoration(
  image: DecorationImage(
    image: ExactAssetImage('assets/textures/grain.png', scale: 2),
    repeat: ImageRepeat.repeat,
    filterQuality: FilterQuality.low,
  ),
);
