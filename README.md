# Annotorious widget

This widget wraps the [Annotorious](http://annotorious.github.io/index.html) library. Place annotations on your images.

## Contributing

For more information on contributing to this repository visit [Contributing to a GitHub repository](https://world.mendix.com/display/howto50/Contributing+to+a+GitHub+repository)!

## Typical usage scenario

Place annotations on images.
 
## Description

Place annotations on images. The annotations are saved as JSON. Your entity needs to inherit from Image, add a unlimited length string for the annotations.

## Configuration


The context entity must inherit from Image.

The only required property is the annotation attribute on the context entity.

Optionally, a microflow can be called after each change on the annotations.
